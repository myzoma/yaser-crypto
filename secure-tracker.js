class SecureRecommendationTracker {
    constructor() {
        this.recommendations = this.loadEncryptedData();
        this.isInitialized = false;
    }

    init() {
        if (!isLoggedIn) return;
        
        this.isInitialized = true;
        this.renderRecommendations();
        this.updateStats();
        this.updateLastUpdateTime();
        
        console.log('🔐 نظام التتبع السري مُفعل');
    }

    // تشفير البيانات
    encryptData(data) {
        try {
            return btoa(JSON.stringify(data));
        } catch (e) {
            return '';
        }
    }

    // فك تشفير البيانات
    decryptData(encryptedData) {
        try {
            return JSON.parse(atob(encryptedData));
        } catch (e) {
            return [];
        }
    }

    // تحميل البيانات المشفرة
    loadEncryptedData() {
        const encrypted = localStorage.getItem('sec_recs_data');
        return encrypted ? this.decryptData(encrypted) : [];
    }

    // حفظ البيانات مشفرة
    saveEncryptedData() {
        const encrypted = this.encryptData(this.recommendations);
        localStorage.setItem('sec_recs_data', encrypted);
    }

   async captureRecommendations() {
    if (!isLoggedIn) return;
            
    try {
        let coins; // إضافة تعريف المتغير هنا
        
        // محاولة الحصول على البيانات من النافذة الأصلية
        const mainWindow = window.opener || window.parent;
        if (mainWindow && mainWindow.yaserCrypto && mainWindow.yaserCrypto.coins) {
            coins = mainWindow.yaserCrypto.coins.slice(0, 15);
        } else {
            // إذا لم تتوفر البيانات، استخدم API مباشرة
            coins = await this.fetchTopCoinsDirectly();
        }
        
        let newCount = 0;
            coins.forEach(coin => {
                const existing = this.recommendations.find(r => 
                    r.symbol === coin.symbol && 
                    Math.abs(new Date() - new Date(r.timestamp)) < 12 * 60 * 60 * 1000 // 12 ساعة
                );

                if (!existing) {
                    this.recommendations.push({
                        id: Date.now() + Math.random(),
                        symbol: coin.symbol,
                        entryPrice: coin.price,
                        currentPrice: coin.price,
                        target1: coin.targets?.target1 || coin.price * 1.05,
                        target2: coin.targets?.target2 || coin.price * 1.10,
                        target3: coin.targets?.target3 || coin.price * 1.15,
                        stopLoss: coin.targets?.stopLoss || coin.price * 0.95,
                        timestamp: new Date().toISOString(),
                        status: 'pending',
                        profit: 0,
                        achievedTargets: [],
                        rank: coin.rank || 0,
                        score: coin.score || 0,
                        volume: coin.volume || 0,
                        change24h: coin.change24h || 0
                    });
                    newCount++;
                }
            });

            this.saveEncryptedData();
            this.renderRecommendations();
            this.updateStats();
            this.updateLastUpdateTime();
            
            alert(`🎯 تم التقاط ${newCount} توصية جديدة من أصل ${coins.length}`);
            
        } catch (error) {
            console.error('خطأ في التقاط التوصيات:', error);
            alert('فشل في التقاط التوصيات. تحقق من الاتصال.');
        }
    }

    async fetchTopCoinsDirectly() {
        try {
            const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
            const data = await response.json();
            
            if (!data.data) return [];
            
            return data.data
                .filter(ticker => ticker.instId.endsWith('-USDT'))
                .map(ticker => {
                    const currentPrice = parseFloat(ticker.last);
                    const openPrice = parseFloat(ticker.open24h);
                    const change24h = ((currentPrice - openPrice) / openPrice) * 100;
                    
                    return {
                        symbol: ticker.instId.replace('-USDT', ''),
                        price: currentPrice,
                        change24h: change24h,
                        volume: parseFloat(ticker.vol24h),
                        targets: {
                            target1: currentPrice * 1.05,
                            target2: currentPrice * 1.10,
                            target3: currentPrice * 1.15,
                            stopLoss: currentPrice * 0.95
                        }
                    };
                })
                .filter(coin => coin.change24h > 2 && coin.volume > 50000)
                .sort((a, b) => b.change24h - a.change24h)
                .slice(0, 10);
                
        } catch (error) {
            console.error('خطأ في جلب البيانات:', error);
            return [];
        }
    }

    async updatePrices() {
        if (!isLoggedIn) return;
        
        console.log('🔄 تحديث الأسعار...');
        let updatedCount = 0;
        
        for (let rec of this.recommendations) {
            if (rec.status === 'pending' || rec.status === 'partial') {
                try {
                    const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${rec.symbol}-USDT`);
                    const data = await response.json();
                    
                    if (data.data && data.data[0]) {
                        const newPrice = parseFloat(data.data[0].last);
                        rec.currentPrice = newPrice;
                        rec.profit = ((newPrice - rec.entryPrice) / rec.entryPrice) * 100;
                        
                        this.checkTargets(rec);
                        updatedCount++;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 150));
                } catch (error) {
                    console.error(`خطأ في تحديث ${rec.symbol}:`, error);
                }
            }
        }

        this.saveEncryptedData();
        this.renderRecommendations();
        this.updateStats();
        this.updateLastUpdateTime();
        
        console.log(`✅ تم تحديث ${updatedCount} عملة`);
    }

    checkTargets(rec) {
        const daysPassed = (new Date() - new Date(rec.timestamp)) / (1000 * 60 * 60 * 24);
        
        // فحص وقف الخسارة
        if (rec.currentPrice <= rec.stopLoss) {
            rec.status = 'failed';
            rec.failedAt = new Date().toISOString();
            return;
        }

        // فحص الأهداف
        let targetsHit = 0;
        
        if (rec.currentPrice >= rec.target1 && !rec.achievedTargets.includes('target1')) {
            rec.achievedTargets.push('target1');
            rec.target1HitAt = new Date().toISOString();
            rec.achievedAt1d = daysPassed <= 1;
            rec.achievedAt3d = daysPassed <= 3;
            rec.achievedAt7d = daysPassed <= 7;
            targetsHit++;
        }

        if (rec.currentPrice >= rec.target2 && !rec.achievedTargets.includes('target2')) {
            rec.achievedTargets.push('target2');
            rec.target2HitAt = new Date().toISOString();
            targetsHit++;
        }

        if (rec.currentPrice >= rec.target3 && !rec.achievedTargets.includes('target3')) {
            rec.achievedTargets.push('target3');
            rec.target3HitAt = new Date().toISOString();
            rec.status = 'completed';
            return;
        }

        // تحديث الحالة
        if (targetsHit > 0 && rec.status === 'pending') {
            rec.status = 'partial';
        }
    }

    renderRecommendations() {
        if (!isLoggedIn) return;
        
        const tbody = document.getElementById('recommendationsBody');
        tbody.innerHTML = '';

        this.recommendations
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .forEach(rec => {
                const row = document.createElement('div');
                row.className = 'table-row';
                
                const statusClass = rec.status === 'completed' ? 'success' : 
                                  rec.status === 'failed' ? 'failed' : 
                                  rec.status === 'partial' ? 'success' : 'pending';

                const daysPassed = Math.floor((new Date() - new Date(rec.timestamp)) / (1000 * 60 * 60 * 24));
                const hoursPassed = Math.floor((new Date() - new Date(rec.timestamp)) / (1000 * 60 * 60));

                row.innerHTML = `
                    <div><strong>${rec.symbol}</strong></div>
                    <div>$${rec.entryPrice.toFixed(4)}</div>
                    <div>$${rec.currentPrice.toFixed(4)}</div>
                    <div>$${rec.target1.toFixed(4)}</div>
                    <div class="${rec.profit >= 0 ? 'success' : 'failed'}">${rec.profit.toFixed(2)}%</div>
                    <div class="${statusClass}">${this.getStatusText(rec.status)}</div>
                    <div>${daysPassed > 0 ? daysPassed + 'د' : hoursPassed + 'س'}</div>
                    <div>
                        <button onclick="tracker.removeRecommendation('${rec.id}')" style="background: #ff4757; padding: 5px 10px; font-size: 12px;">حذف</button>
                    </div>
                `;
                
                tbody.appendChild(row);
            });
    }

    getStatusText(status) {
        const statusMap = {
            'pending': '⏳ انتظار',
            'partial': '🎯 جزئي',
            'completed': '✅ مكتمل',
            'failed': '❌ فاشل'
        };
        return statusMap[status] || status;
    }

    updateStats() {
        if (!isLoggedIn) return;
        
        const total = this.recommendations.length;
        const active = this.recommendations.filter(r => r.status === 'pending' || r.status === 'partial').length;
        const success1d = this.recommendations.filter(r => r.achievedAt1d).length;
        const success3d = this.recommendations.filter(r => r.achievedAt3d).length;
        const success7d = this.recommendations.filter(r => r.achievedAt7d).length;
        const successRate = total > 0 ? ((success7d / total) * 100).toFixed(1) : 0;
        
        // حساب إجمالي الربح
        const totalProfit = this.recommendations
            .filter(r => r.status === 'completed' || r.status === 'partial')
            .reduce((sum, r) => sum + (r.profit > 0 ? r.profit : 0), 0);

        document.getElementById('totalProfit').textContent = `${totalProfit.toFixed(2)}%`;
        document.getElementById('activeRecs').textContent = active;
        document.getElementById('success1d').textContent = success1d;
        document.getElementById('success3d').textContent = success3d;
        document.getElementById('success7d').textContent = success7d;
        document.getElementById('successRate').textContent = successRate + '%';
    }

    updateLastUpdateTime() {
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('ar');
    }

    removeRecommendation(id) {
        if (confirm('هل تريد حذف هذه التوصية؟')) {
            this.recommendations = this.recommendations.filter(r => r.id != id);
            this.saveEncryptedData();
            this.renderRecommendations();
            this.updateStats();
        }
    }

    generateReport() {
        if (!isLoggedIn) return;
        
        const report = this.calculateDetailedStats();
        
        const reportWindow = window.open('', '_blank', 'width=900,height=700');
        reportWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>تقرير سري</title>
                <style>
                    body { font-family: Arial; background: #0a0a0a; color: white; padding: 30px; }
                    .header { text-align: center; margin-bottom: 40px; color: #00d4aa; }
                    .section { margin-bottom: 30px; padding: 20px; background: #1a1a1a; border-radius: 10px; }
                    .profit-positive { color: #00ff88; }
                    .profit-negative { color: #ff4757; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { padding: 10px; text-align: right; border-bottom: 1px solid #333; }
                    th { background: #2a2a2a; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 التقرير السري المفصل</h1>
                    <p>تاريخ التقرير: ${new Date().toLocaleString('ar')}</p>
                </div>
                
                <div class="section">
                    <h2>📈 الإحصائيات العامة</h2>
                    <p><strong>إجمالي التوصيات:</strong> ${report.total}</p>
                    <p><strong>التوصيات النشطة:</strong> ${report.active}</p>
                    <p><strong>نجح خلال 24 ساعة:</strong> ${report.success1d} (${report.rate1d}%)</p>
                    <p><strong>نجح خلال 3 أيام:</strong> ${report.success3d} (${report.rate3d}%)</p>
                    <p><strong>نجح خلال 7 أيام:</strong> ${report.success7d} (${report.rate7d}%)</p>
                    <p><strong>إجمالي الربح:</strong> <span class="profit-positive">${report.totalProfit}%</span></p>
                    <p><strong>متوسط الربح:</strong> ${report.avgProfit}%</p>
                </div>
                
                <div class="section">
                    <h2>🏆 أفضل العملات أداءً</h2>
                    <table>
                        <tr><th>العملة</th><th>الربح %</th><th>الحالة</th></tr>
                        ${report.topPerformers.map(coin => 
                            `<tr><td>${coin.symbol}</td><td class="profit-positive">${coin.profit.toFixed(2)}%</td><td>${this.getStatusText(coin.status)}</td></tr>`
                        ).join('')}
                    </table>
                </div>
                
                <div class="section">
                    <h2>📉 أسوأ العملات أداءً</h2>
                    <table>
                        <tr><th>العملة</th><th>الخسارة %</th><th>الحالة</th></tr>
                        ${report.worstPerformers.map(coin => 
                            `<tr><td>${coin.symbol}</td><td class="profit-negative">${coin.profit.toFixed(2)}%</td><td>${this.getStatusText(coin.status)}</td></tr>`
                        ).join('')}
                    </table>
                </div>
                
                <div class="section">
                    <h2>⚡ التوصيات السريعة (أقل من 24 ساعة)</h2>
                    <table>
                        <tr><th>العملة</th><th>الربح %</th><th>المدة (ساعات)</th></tr>
                        ${report.fastWins.map(coin => 
                            `<tr><td>${coin.symbol}</td><td class="profit-positive">${coin.profit.toFixed(2)}%</td><td>${coin.duration}</td></tr>`
                        ).join('')}
                    </table>
                </div>
                
                <div class="section">
                    <h2>📊 تحليل الأداء الشهري</h2>
                    <p><strong>هذا الشهر:</strong> ${report.monthlyStats.total} توصية</p>
                    <p><strong>نجح:</strong> ${report.monthlyStats.success} (${report.monthlyStats.rate}%)</p>
                    <p><strong>الربح الشهري:</strong> <span class="profit-positive">${report.monthlyStats.profit}%</span></p>
                </div>
                
                <script>
                    // منع الطباعة والحفظ
                    document.addEventListener('keydown', function(e) {
                        if (e.ctrlKey && (e.key === 'p' || e.key === 's')) {
                            e.preventDefault();
                            alert('غير مسموح!');
                        }
                    });
                    
                    // إغلاق النافذة بعد 5 دقائق
                    setTimeout(() => {
                        if (confirm('سيتم إغلاق التقرير خلال 10 ثوان لأسباب أمنية')) {
                            setTimeout(() => window.close(), 10000);
                        } else {
                            window.close();
                        }
                    }, 300000);
                </script>
            </body>
            </html>
        `);
    }

    calculateDetailedStats() {
        const total = this.recommendations.length;
        const active = this.recommendations.filter(r => r.status === 'pending' || r.status === 'partial').length;
        const success1d = this.recommendations.filter(r => r.achievedAt1d).length;
        const success3d = this.recommendations.filter(r => r.achievedAt3d).length;
        const success7d = this.recommendations.filter(r => r.achievedAt7d).length;
        
        const rate1d = total > 0 ? ((success1d / total) * 100).toFixed(1) : 0;
        const rate3d = total > 0 ? ((success3d / total) * 100).toFixed(1) : 0;
        const rate7d = total > 0 ? ((success7d / total) * 100).toFixed(1) : 0;
        
        const totalProfit = this.recommendations
            .filter(r => r.status === 'completed' || r.status === 'partial')
            .reduce((sum, r) => sum + (r.profit > 0 ? r.profit : 0), 0);
            
        const avgProfit = total > 0 ? 
            (this.recommendations.reduce((sum, r) => sum + r.profit, 0) / total).toFixed(2) : 0;
        
        const topPerformers = this.recommendations
            .filter(r => r.profit > 0)
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 5);
            
        const worstPerformers = this.recommendations
            .filter(r => r.profit < 0)
            .sort((a, b) => a.profit - b.profit)
            .slice(0, 5);

        // التوصيات السريعة (أقل من 24 ساعة)
        const fastWins = this.recommendations
            .filter(r => r.achievedAt1d && r.profit > 0)
            .map(r => ({
                ...r,
                duration: Math.floor((new Date(r.target1HitAt) - new Date(r.timestamp)) / (1000 * 60 * 60))
            }))
            .sort((a, b) => a.duration - b.duration)
            .slice(0, 5);

        // إحصائيات شهرية
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const monthlyRecs = this.recommendations.filter(r => {
            const recDate = new Date(r.timestamp);
            return recDate.getMonth() === thisMonth && recDate.getFullYear() === thisYear;
        });
        
        const monthlySuccess = monthlyRecs.filter(r => r.status === 'completed' || r.status === 'partial').length;
        const monthlyProfit = monthlyRecs.reduce((sum, r) => sum + (r.profit > 0 ? r.profit : 0), 0);

        return {
            total,
            active,
            success1d,
            success3d,
            success7d,
            rate1d,
            rate3d,
            rate7d,
            totalProfit: totalProfit.toFixed(2),
            avgProfit,
            topPerformers,
            worstPerformers,
            fastWins,
            monthlyStats: {
                total: monthlyRecs.length,
                success: monthlySuccess,
                rate: monthlyRecs.length > 0 ? ((monthlySuccess / monthlyRecs.length) * 100).toFixed(1) : 0,
                profit: monthlyProfit.toFixed(2)
            }
        };
    }

    exportData() {
        if (!isLoggedIn) return;
        
        const exportData = {
            recommendations: this.recommendations,
            exportDate: new Date().toISOString(),
            totalCount: this.recommendations.length
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `secure_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        // تنظيف الرابط
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    importData() {
        if (!isLoggedIn) return;
        
        document.getElementById('importFile').click();
    }

    clearData() {
        if (!isLoggedIn) return;
        
        if (confirm('⚠️ هذا سيحذف جميع البيانات نهائياً!\nهل أنت متأكد؟')) {
            if (confirm('تأكيد أخير: سيتم حذف جميع التوصيات والإحصائيات!')) {
                this.recommendations = [];
                this.saveEncryptedData();
                this.renderRecommendations();
                this.updateStats();
                alert('✅ تم حذف جميع البيانات');
            }
        }
    }

    handleImport(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (importedData.recommendations && Array.isArray(importedData.recommendations)) {
                        const newRecs = importedData.recommendations.filter(rec => 
                            !this.recommendations.find(existing => existing.id === rec.id)
                        );
                        
                        this.recommendations = [...this.recommendations, ...newRecs];
                        this.saveEncryptedData();
                        this.renderRecommendations();
                        this.updateStats();
                        
                        alert(`✅ تم استيراد ${newRecs.length} توصية جديدة`);
                    } else {
                        alert('❌ ملف غير صالح');
                    }
                } catch (error) {
                    alert('❌ خطأ في قراءة الملف');
                }
            };
            reader.readAsText(file);
        }
    }
}

// إنشاء المتتبع
const tracker = new SecureRecommendationTracker();

// ربط أحداث الاستيراد
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('importFile').addEventListener('change', (e) => {
        tracker.handleImport(e);
    });
});

// حماية إضافية
setInterval(() => {
    if (isLoggedIn && !document.hasFocus()) {
        // تسجيل خروج تلقائي عند عدم التركيز لمدة طويلة
        let inactiveTime = 0;
        const inactiveInterval = setInterval(() => {
            inactiveTime++;
            if (inactiveTime >= 300) { // 5 دقائق
                logout();
                clearInterval(inactiveInterval);
            }
        }, 1000);
        
        document.addEventListener('focus', () => {
            clearInterval(inactiveInterval);
        }, { once: true });
    }
}, 60000);

// منع لصق كلمة المرور
document.getElementById('passwordInput').addEventListener('paste', function(e) {
    e.preventDefault();
});

// تنظيف البيانات عند إغلاق النافذة
window.addEventListener('beforeunload', function() {
    if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
    }
});
