// مدير التوصيات
class RecommendationsManager {
    constructor() {
        this.storageKey = 'crypto_recommendations';
        this.reportsKey = 'crypto_reports';
        this.lastCopyKey = 'last_copy_time';
        this.init();
    }

    init() {
        // التحقق من الحاجة لنسخ توصيات جديدة
        this.checkAndCopyRecommendations();
        
        // التحقق من وجود صفحة الإدارة
        if (window.location.search.includes('admin=true')) {
            this.showAdminPanel();
        }
    }

    // التحقق من الحاجة لنسخ توصيات جديدة كل 24 ساعة
    checkAndCopyRecommendations() {
        const lastCopyTime = localStorage.getItem(this.lastCopyKey);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (!lastCopyTime || (now - parseInt(lastCopyTime)) >= twentyFourHours) {
            // إنشاء تقرير للتوصيات السابقة قبل النسخ الجديد
            if (lastCopyTime) {
                this.generateReport();
            }
            
            // نسخ توصيات جديدة
            setTimeout(() => {
                this.copyCurrentRecommendations();
            }, 5000); // انتظار 5 ثواني للتأكد من تحميل البيانات
        }
    }

    // نسخ جميع التوصيات الحالية
    copyCurrentRecommendations() {
        const yaserCrypto = window.yaserCryptoInstance;
        if (!yaserCrypto || !yaserCrypto.coins || yaserCrypto.coins.length === 0) {
            console.log('لا توجد بيانات للنسخ');
            return;
        }

        const recommendations = yaserCrypto.coins.map(coin => ({
            symbol: coin.symbol,
            copyTime: Date.now(),
            copyDate: new Date().toLocaleString('ar-SA'),
            originalPrice: coin.price,
            change24h: coin.change24h,
            volume: coin.volume,
            score: coin.score,
            rank: coin.rank,
            dataSource: coin.dataSource,
            priority: coin.priority,
            targets: {
                target1: coin.targets.target1,
                target2: coin.targets.target2,
                target3: coin.targets.target3,
                stopLoss: coin.targets.stopLoss
            },
            technicalIndicators: coin.technicalIndicators,
            conditions: coin.conditions,
            status: 'قيد التنفيذ',
            currentPrice: coin.price,
            maxReached: coin.price,
            minReached: coin.price
        }));

        // حفظ التوصيات
        localStorage.setItem(this.storageKey, JSON.stringify(recommendations));
        localStorage.setItem(this.lastCopyKey, Date.now().toString());

        console.log(`تم نسخ ${recommendations.length} توصية جديدة`);
    }

    // إنشاء تقرير للتوصيات السابقة
    generateReport() {
        const recommendations = this.getCurrentRecommendations();
        if (!recommendations || recommendations.length === 0) {
            return;
        }

        // تحديث حالة التوصيات قبل إنشاء التقرير
        this.updateRecommendationsStatus();

        const report = {
            id: Date.now(),
            date: new Date().toLocaleString('ar-SA'),
            period: `${new Date(recommendations[0].copyTime).toLocaleDateString('ar-SA')} - ${new Date().toLocaleDateString('ar-SA')}`,
            totalRecommendations: recommendations.length,
            successful: recommendations.filter(r => r.status === 'ناجحة').length,
            failed: recommendations.filter(r => r.status === 'فاشلة').length,
            pending: recommendations.filter(r => r.status === 'قيد التنفيذ').length,
            recommendations: recommendations
        };

        // حفظ التقرير
        const existingReports = JSON.parse(localStorage.getItem(this.reportsKey) || '[]');
        existingReports.push(report);
        localStorage.setItem(this.reportsKey, JSON.stringify(existingReports));

        console.log(`تم إنشاء تقرير جديد: ${report.successful} ناجحة، ${report.failed} فاشلة، ${report.pending} قيد التنفيذ`);
    }

    // تحديث حالة التوصيات
    updateRecommendationsStatus() {
        const recommendations = this.getCurrentRecommendations();
        if (!recommendations) return;

        const yaserCrypto = window.yaserCryptoInstance;
        if (!yaserCrypto || !yaserCrypto.coins) return;

        recommendations.forEach(recommendation => {
            // البحث عن العملة في البيانات الحالية
            const currentCoin = yaserCrypto.coins.find(c => c.symbol === recommendation.symbol);
            
            if (currentCoin) {
                recommendation.currentPrice = currentCoin.price;
                
                // تحديث أعلى وأقل سعر وصلت إليه
                if (currentCoin.price > recommendation.maxReached) {
                    recommendation.maxReached = currentCoin.price;
                }
                if (currentCoin.price < recommendation.minReached) {
                    recommendation.minReached = currentCoin.price;
                }

                // تحديد حالة التوصية
                if (recommendation.maxReached >= recommendation.targets.target1) {
                    recommendation.status = 'ناجحة';
                    
                    // تحديد أي هدف تم الوصول إليه
                    if (recommendation.maxReached >= recommendation.targets.target3) {
                        recommendation.achievedTarget = 'الهدف الثالث';
                    } else if (recommendation.maxReached >= recommendation.targets.target2) {
                        recommendation.achievedTarget = 'الهدف الثاني';
                    } else {
                        recommendation.achievedTarget = 'الهدف الأول';
                    }
                } else if (recommendation.minReached <= recommendation.targets.stopLoss) {
                    recommendation.status = 'فاشلة';
                } else {
                    recommendation.status = 'قيد التنفيذ';
                }

                // حساب نسبة الربح/الخسارة
                recommendation.profitLoss = ((recommendation.currentPrice - recommendation.originalPrice) / recommendation.originalPrice) * 100;
            }
        });

        // حفظ التحديثات
        localStorage.setItem(this.storageKey, JSON.stringify(recommendations));
    }

    // الحصول على التوصيات الحالية
    getCurrentRecommendations() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : null;
    }

    // الحصول على جميع التقارير
    getAllReports() {
        const data = localStorage.getItem(this.reportsKey);
        return data ? JSON.parse(data) : [];
    }

    // عرض صفحة الإدارة
    showAdminPanel() {
        // إخفاء المحتوى الأصلي
        document.body.innerHTML = '';
        
        // إنشاء صفحة الإدارة
        const adminHTML = `
            <div id="adminPanel">
                <style>
                    #adminPanel {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        direction: rtl;
                        padding: 20px;
                        background: #f5f5f5;
                        min-height: 100vh;
                    }
                    .admin-header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 10px;
                        margin-bottom: 20px;
                        text-align: center;
                    }
                    .admin-nav {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 20px;
                        justify-content: center;
                    }
                    .nav-btn {
                        padding: 10px 20px;
                        background: #667eea;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: all 0.3s;
                    }
                    .nav-btn:hover, .nav-btn.active {
                        background: #764ba2;
                        transform: translateY(-2px);
                    }
                    .admin-section {
                        background: white;
                        padding: 20px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        margin-bottom: 20px;
                        display: none;
                    }
                    .admin-section.active {
                        display: block;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    }
                    .stat-card {
                        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 10px;
                        text-align: center;
                    }
                    .stat-number {
                        font-size: 2em;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .recommendations-table, .reports-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    .recommendations-table th, .recommendations-table td,
                    .reports-table th, .reports-table td {
                        padding: 12px;
                        text-align: center;
                        border-bottom: 1px solid #ddd;
                    }
                    .recommendations-table th, .reports-table th {
                        background: #f8f9fa;
                        font-weight: bold;
                    }
                    .status-success { color: #28a745; font-weight: bold; }
                    .status-failed { color: #dc3545; font-weight: bold; }
                    .status-pending { color: #ffc107; font-weight: bold; }
                    .profit-positive { color: #28a745; font-weight: bold; }
                    .profit-negative { color: #dc3545; font-weight: bold; }
                    .back-btn {
                        position: fixed;
                        top: 20px;
                        left: 20px;
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        text-decoration: none;
                    }
                </style>

                <a href="?" class="back-btn">العودة للموقع</a>

                <div class="admin-header">
                    <h1>🔧 مدير التوصيات</h1>
                    <p>إدارة ومراقبة التوصيات والتقارير</p>
                </div>

                <div class="admin-nav">
                    <button class="nav-btn active" onclick="showSection('current')">التوصيات الحالية</button>
                    <button class="nav-btn" onclick="showSection('reports')">التقارير</button>
                    <button class="nav-btn" onclick="showSection('stats')">الإحصائيات</button>
                </div>

                <div id="currentSection" class="admin-section active">
                    <h2>📊 التوصيات الحالية</h2>
                    <div id="currentRecommendations"></div>
                </div>

                <div id="reportsSection" class="admin-section">
                    <h2>📈 التقارير</h2>
                    <div id="reportsContent"></div>
                </div>

                <div id="statsSection" class="admin-section">
                    <h2>📋 الإحصائيات العامة</h2>
                    <div id="statsContent"></div>
                </div>
            </div>
        `;

        document.body.innerHTML = adminHTML;

        // إضافة الوظائف
        window.showSection = (section) => {
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            
            document.getElementById(section + 'Section').classList.add('active');
            event.target.classList.add('active');
        };

        // تحديث البيانات وعرضها
        this.updateRecommendationsStatus();
        this.loadAdminData();
    }

    // تحميل بيانات صفحة الإدارة
    loadAdminData() {
        this.loadCurrentRecommendations();
        this.loadReports();
        this.loadStats();
    }

    // تحميل التوصيات الحالية
    loadCurrentRecommendations() {
        const recommendations = this.getCurrentRecommendations();
        const container = document.getElementById('currentRecommendations');

        if (!recommendations || recommendations.length === 0) {
            container.innerHTML = '<p>لا توجد توصيات حالية</p>';
            return;
        }

        const lastCopyTime = localStorage.getItem(this.lastCopyKey);
        const copyDate = lastCopyTime ? new Date(parseInt(lastCopyTime)).toLocaleString('ar-SA') : 'غير محدد';

        let html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${recommendations.length}</div>
                    <div>إجمالي التوصيات</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${recommendations.filter(r => r.status === 'ناجحة').length}</div>
                    <div>ناجحة</div>
                </div>
                            <div class="stat-card">
                    <div class="stat-number">${recommendations.filter(r => r.status === 'فاشلة').length}</div>
                    <div>فاشلة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${recommendations.filter(r => r.status === 'قيد التنفيذ').length}</div>
                    <div>قيد التنفيذ</div>
                </div>
            </div>
            <p><strong>تاريخ آخر نسخ:</strong> ${copyDate}</p>
            <table class="recommendations-table">
                <thead>
                    <tr>
                        <th>العملة</th>
                        <th>السعر الأصلي</th>
                        <th>السعر الحالي</th>
                        <th>الهدف الأول</th>
                        <th>الهدف الثاني</th>
                        <th>الهدف الثالث</th>
                        <th>وقف الخسارة</th>
                        <th>الحالة</th>
                        <th>الربح/الخسارة</th>
                        <th>أعلى سعر</th>
                        <th>أقل سعر</th>
                    </tr>
                </thead>
                <tbody>
        `;

        recommendations.forEach(rec => {
            const statusClass = rec.status === 'ناجحة' ? 'status-success' : 
                               rec.status === 'فاشلة' ? 'status-failed' : 'status-pending';
            const profitClass = rec.profitLoss > 0 ? 'profit-positive' : 'profit-negative';
            
            html += `
                <tr>
                    <td><strong>${rec.symbol}</strong></td>
                    <td>$${rec.originalPrice.toFixed(6)}</td>
                    <td>$${rec.currentPrice.toFixed(6)}</td>
                    <td>$${rec.targets.target1.toFixed(6)}</td>
                    <td>$${rec.targets.target2.toFixed(6)}</td>
                    <td>$${rec.targets.target3.toFixed(6)}</td>
                    <td>$${rec.targets.stopLoss.toFixed(6)}</td>
                    <td class="${statusClass}">${rec.status}</td>
                    <td class="${profitClass}">${rec.profitLoss.toFixed(2)}%</td>
                    <td>$${rec.maxReached.toFixed(6)}</td>
                    <td>$${rec.minReached.toFixed(6)}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // تحميل التقارير
    loadReports() {
        const reports = this.getAllReports();
        const container = document.getElementById('reportsContent');
        
        if (!reports || reports.length === 0) {
            container.innerHTML = '<p>لا توجد تقارير متاحة</p>';
            return;
        }

        let html = `
            <table class="reports-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>الفترة</th>
                        <th>إجمالي التوصيات</th>
                        <th>ناجحة</th>
                        <th>فاشلة</th>
                        <th>قيد التنفيذ</th>
                        <th>معدل النجاح</th>
                        <th>تفاصيل</th>
                    </tr>
                </thead>
                <tbody>
        `;

        reports.reverse().forEach((report, index) => {
            const successRate = report.totalRecommendations > 0 ? 
                ((report.successful / report.totalRecommendations) * 100).toFixed(1) : 0;
            
            html += `
                <tr>
                    <td>${report.date}</td>
                    <td>${report.period}</td>
                    <td>${report.totalRecommendations}</td>
                    <td class="status-success">${report.successful}</td>
                    <td class="status-failed">${report.failed}</td>
                    <td class="status-pending">${report.pending}</td>
                    <td><strong>${successRate}%</strong></td>
                    <td><button onclick="showReportDetails(${report.id})">عرض التفاصيل</button></td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        // إضافة وظيفة عرض تفاصيل التقرير
        window.showReportDetails = (reportId) => {
            const report = reports.find(r => r.id === reportId);
            if (!report) return;

            const detailsWindow = window.open('', '_blank', 'width=1200,height=800');
            detailsWindow.document.write(`
                <html>
                <head>
                    <title>تفاصيل التقرير - ${report.date}</title>
                    <style>
                        body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { padding: 10px; text-align: center; border: 1px solid #ddd; }
                        th { background: #f8f9fa; }
                        .status-success { color: #28a745; font-weight: bold; }
                        .status-failed { color: #dc3545; font-weight: bold; }
                        .status-pending { color: #ffc107; font-weight: bold; }
                        .profit-positive { color: #28a745; font-weight: bold; }
                        .profit-negative { color: #dc3545; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>تفاصيل التقرير</h1>
                    <p><strong>التاريخ:</strong> ${report.date}</p>
                    <p><strong>الفترة:</strong> ${report.period}</p>
                    <p><strong>إجمالي التوصيات:</strong> ${report.totalRecommendations}</p>
                    <p><strong>ناجحة:</strong> ${report.successful} | <strong>فاشلة:</strong> ${report.failed} | <strong>قيد التنفيذ:</strong> ${report.pending}</p>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>العملة</th>
                                <th>السعر الأصلي</th>
                                <th>السعر النهائي</th>
                                <th>الحالة</th>
                                <th>الهدف المحقق</th>
                                <th>الربح/الخسارة</th>
                                <th>أعلى سعر</th>
                                <th>أقل سعر</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.recommendations.map(rec => {
                                const statusClass = rec.status === 'ناجحة' ? 'status-success' : 
                                                   rec.status === 'فاشلة' ? 'status-failed' : 'status-pending';
                                const profitClass = rec.profitLoss > 0 ? 'profit-positive' : 'profit-negative';
                                
                                return `
                                    <tr>
                                        <td><strong>${rec.symbol}</strong></td>
                                        <td>$${rec.originalPrice.toFixed(6)}</td>
                                        <td>$${rec.currentPrice.toFixed(6)}</td>
                                        <td class="${statusClass}">${rec.status}</td>
                                        <td>${rec.achievedTarget || '-'}</td>
                                        <td class="${profitClass}">${rec.profitLoss.toFixed(2)}%</td>
                                        <td>$${rec.maxReached.toFixed(6)}</td>
                                        <td>$${rec.minReached.toFixed(6)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `);
        };
    }

    // تحميل الإحصائيات العامة
    loadStats() {
        const reports = this.getAllReports();
        const currentRecommendations = this.getCurrentRecommendations();
        const container = document.getElementById('statsContent');

        if (!reports || reports.length === 0) {
            container.innerHTML = '<p>لا توجد إحصائيات متاحة</p>';
            return;
        }

        // حساب الإحصائيات العامة
        const totalReports = reports.length;
        const totalRecommendations = reports.reduce((sum, report) => sum + report.totalRecommendations, 0);
        const totalSuccessful = reports.reduce((sum, report) => sum + report.successful, 0);
        const totalFailed = reports.reduce((sum, report) => sum + report.failed, 0);
        const overallSuccessRate = totalRecommendations > 0 ? 
            ((totalSuccessful / totalRecommendations) * 100).toFixed(1) : 0;

        // إحصائيات التوصيات الحالية
        const currentTotal = currentRecommendations ? currentRecommendations.length : 0;
        const currentSuccessful = currentRecommendations ? 
            currentRecommendations.filter(r => r.status === 'ناجحة').length : 0;
        const currentFailed = currentRecommendations ? 
            currentRecommendations.filter(r => r.status === 'فاشلة').length : 0;
        const currentPending = currentRecommendations ? 
            currentRecommendations.filter(r => r.status === 'قيد التنفيذ').length : 0;

        const html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${totalReports}</div>
                    <div>إجمالي التقارير</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalRecommendations}</div>
                    <div>إجمالي التوصيات</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalSuccessful}</div>
                    <div>إجمالي الناجحة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${overallSuccessRate}%</div>
                    <div>معدل النجاح العام</div>
                </div>
            </div>
            
            <h3>📊 إحصائيات التوصيات الحالية</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${currentTotal}</div>
                    <div>التوصيات الحالية</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${currentSuccessful}</div>
                    <div>ناجحة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${currentFailed}</div>
                    <div>فاشلة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${currentPending}</div>
                    <div>قيد التنفيذ</div>
                </div>
            </div>

            <h3>📈 تطور الأداء</h3>
            <table class="reports-table">
                <thead>
                    <tr>
                        <th>التقرير</th>
                        <th>معدل النجاح</th>
                        <th>عدد التوصيات</th>
                        <th>الناجحة</th>
                        <th>الفاشلة</th>
                    </tr>
                </thead>
                <tbody>
                    ${reports.slice(-10).reverse().map((report, index) => {
                        const successRate = report.totalRecommendations > 0 ? 
                            ((report.successful / report.totalRecommendations) * 100).toFixed(1) : 0;
                        return `
                            <tr>
                                <td>تقرير ${reports.length - index}</td>
                                <td><strong>${successRate}%</strong></td>
                                <td>${report.totalRecommendations}</td>
                                <td class="status-success">${report.successful}</td>
                                <td class="status-failed">${report.failed}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    }

    // حذف جميع البيانات (للاختبار)
    clearAllData() {
        if (confirm('هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.reportsKey);
            localStorage.removeItem(this.lastCopyKey);
            alert('تم حذف جميع البيانات');
            location.reload();
        }
    }

    // فرض نسخ توصيات جديدة
    forceCopyRecommendations() {
        localStorage.removeItem(this.lastCopyKey);
        this.checkAndCopyRecommendations();
        alert('تم فرض نسخ توصيات جديدة');
        setTimeout(() => location.reload(), 2000);
    }

    // تصدير البيانات
    exportData() {
        const data = {
            recommendations: this.getCurrentRecommendations(),
            reports: this.getAllReports(),
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crypto-recommendations-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // استيراد البيانات
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.recommendations) {
                    localStorage.setItem(this.storageKey, JSON.stringify(data.recommendations));
                }
                
                if (data.reports) {
                    localStorage.setItem(this.reportsKey, JSON.stringify(data.reports));
                }
                
                alert('تم استيراد البيانات بنجاح');
                location.reload();
            } catch (error) {
                alert('خطأ في استيراد البيانات: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    // الحصول على إحصائيات سريعة
    getQuickStats() {
        const recommendations = this.getCurrentRecommendations();
        const reports = this.getAllReports();
        
        if (!recommendations && (!reports || reports.length === 0)) {
            return null;
        }

        const currentStats = recommendations ? {
            total: recommendations.length,
            successful: recommendations.filter(r => r.status === 'ناجحة').length,
            failed: recommendations.filter(r => r.status === 'فاشلة').length,
            pending: recommendations.filter(r => r.status === 'قيد التنفيذ').length
        } : { total: 0, successful: 0, failed: 0, pending: 0 };

        const overallStats = reports.length > 0 ? {
            totalReports: reports.length,
            totalRecommendations: reports.reduce((sum, r) => sum + r.totalRecommendations, 0),
            totalSuccessful: reports.reduce((sum, r) => sum + r.successful, 0),
            totalFailed: reports.reduce((sum, r) => sum + r.failed, 0)
        } : { totalReports: 0, totalRecommendations: 0, totalSuccessful: 0, totalFailed: 0 };

        return {
            current: currentStats,
            overall: overallStats,
            successRate: overallStats.totalRecommendations > 0 ? 
                ((overallStats.totalSuccessful / overallStats.totalRecommendations) * 100).toFixed(1) : 0
        };
    }

    // عرض إشعار بالإحصائيات في الصفحة الرئيسية
    showStatsNotification() {
        const stats = this.getQuickStats();
        if (!stats) return;

        // إنشاء عنصر الإشعار
        const notification = document.createElement('div');
        notification.id = 'statsNotification';
        notification.innerHTML = `
            <style>
                #statsNotification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px;
                    border-radius: 10px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    z-index: 10000;
                    font-family: Arial, sans-serif;
                    direction: rtl;
                    min-width: 250px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                #statsNotification:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                }
                .stats-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-align: center;
                    border-bottom: 1px solid rgba(255,255,255,0.3);
                    padding-bottom: 5px;
                }
                .stats-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-size: 14px;
                }
                .close-btn {
                    position: absolute;
                    top: 5px;
                    left: 10px;
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    opacity: 0.7;
                }
                .close-btn:hover {
                    opacity: 1;
                }
            </style>
            <button class="close-btn" onclick="this.parentElement.remove()">×</button>
            <div class="stats-title">📊 إحصائيات التوصيات</div>
            <div class="stats-row">
                <span>التوصيات الحالية:</span>
                <span><strong>${stats.current.total}</strong></span>
            </div>
            <div class="stats-row">
                <span>ناجحة:</span>
                <span style="color: #4CAF50;"><strong>${stats.current.successful}</strong></span>
            </div>
            <div class="stats-row">
                <span>فاشلة:</span>
                <span style="color: #f44336;"><strong>${stats.current.failed}</strong></span>
            </div>
            <div class="stats-row">
                <span>قيد التنفيذ:</span>
                <span style="color: #FF9800;"><strong>${stats.current.pending}</strong></span>
            </div>
            <div class="stats-row" style="border-top: 1px solid rgba(255,255,255,0.3); padding-top: 5px; margin-top: 10px;">
                <span>معدل النجاح العام:</span>
                <span><strong>${stats.successRate}%</strong></span>
            </div>
            <div style="text-align: center; margin-top: 10px; font-size: 12px; opacity: 0.8;">
                اضغط للوصول لصفحة الإدارة
            </div>
        `;

        // إضافة حدث النقر للانتقال لصفحة الإدارة
        notification.addEventListener('click', () => {
            window.location.href = window.location.pathname + '?admin=true';
        });

        document.body.appendChild(notification);

        // إخفاء الإشعار تلقائياً بعد 10 ثواني
        setTimeout(() => {
            if (document.getElementById('statsNotification')) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 10000);
    }

    // مراقبة التغييرات في الأسعار وتحديث التوصيات
    startPriceMonitoring() {
        setInterval(() => {
            this.updateRecommendationsStatus();
        }, 30000); // تحديث كل 30 ثانية
    }

    // إنشاء تقرير يومي تلقائي
    createDailyReport() {
        const now = new Date();
        const lastReportDate = localStorage.getItem('lastDailyReport');
        
        if (lastReportDate) {
            const lastDate = new Date(lastReportDate);
            const diffTime = Math.abs(now - lastDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 1) {
                return; // لم يمر يوم كامل بعد
            }
        }

        // إنشاء تقرير يومي
        this.generateReport();
        localStorage.setItem('lastDailyReport', now.toISOString());
        
        console.log('تم إنشاء التقرير اليومي التلقائي');
    }

    // تنظيف البيانات القديمة
    cleanOldData() {
        const reports = this.getAllReports();
        const maxReports = 50; // الاحتفاظ بآخر 50 تقرير فقط

        if (reports.length > maxReports) {
            const recentReports = reports.slice(-maxReports);
            localStorage.setItem(this.reportsKey, JSON.stringify(recentReports));
            console.log(`تم تنظيف البيانات القديمة. تم الاحتفاظ بآخر ${maxReports} تقرير`);
        }
    }

    // إضافة أزرار إدارة سريعة للصفحة الرئيسية
    addQuickAdminButtons() {
        if (window.location.search.includes('admin=true')) {
            return; // لا نضيف الأزرار في صفحة الإدارة
        }

        const quickButtons = document.createElement('div');
        quickButtons.id = 'quickAdminButtons';
        quickButtons.innerHTML = `
            <style>
                #quickAdminButtons {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .quick-btn {
                    padding: 10px 15px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    min-width: 120px;
                }
                .quick-btn:hover {
                    background: #764ba2;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                }
                .quick-btn.danger {
                    background: #dc3545;
                }
                .quick-btn.danger:hover {
                    background: #c82333;
                }
                .quick-btn.success {
                    background: #28a745;
                }
                .quick-btn.success:hover {
                    background: #218838;
                }
            </style>
            <button class="quick-btn" onclick="window.location.href='?admin=true'">
                🔧 الإدارة
            </button>
            <button class="quick-btn success" onclick="recommendationsManager.forceCopyRecommendations()">
                🔄 نسخ جديد
            </button>
            <button class="quick-btn" onclick="recommendationsManager.exportData()">
                📤 تصدير
            </button>
            <input type="file" id="importFile" accept=".json" style="display: none;" 
                   onchange="recommendationsManager.importData(this.files[0])">
            <button class="quick-btn" onclick="document.getElementById('importFile').click()">
                📥 استيراد
            </button>
            <button class="quick-btn danger" onclick="recommendationsManager.clearAllData()">
                🗑️ حذف الكل
            </button>
        `;

        document.body.appendChild(quickButtons);
    }
}

// تهيئة مدير التوصيات
const recommendationsManager = new RecommendationsManager();

// إضافة الوظائف للنافذة العامة
window.recommendationsManager = recommendationsManager;

// بدء مراقبة الأسعار
recommendationsManager.startPriceMonitoring();

// إنشاء تقرير يومي تلقائي
recommendationsManager.createDailyReport();

// تنظيف البيانات القديمة
recommendationsManager.cleanOldData();

// عرض إشعار الإحصائيات (بعد تحميل الصفحة)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        recommendationsManager.showStatsNotification();
        recommendationsManager.addQuickAdminButtons();
    }, 3000);
});

// إضافة مستمع للتحديث التلقائي عند تغيير البيانات
window.addEventListener('storage', (e) => {
    if (e.key === recommendationsManager.storageKey || e.key === recommendationsManager.reportsKey) {
        // إعادة تحميل البيانات في صفحة الإدارة
        if (window.location.search.includes('admin=true')) {
            recommendationsManager.loadAdminData();
        }
    }
});

// تصدير الكلاس للاستخدام الخارجي
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecommendationsManager;
}

console.log('✅ تم تحميل مدير التوصيات بنجاح');
console.log('📊 للوصول لصفحة الإدارة: أضف ?admin=true للرابط');
console.log('🔧 الوظائف المتاحة:', {
    'نسخ توصيات جديدة': 'recommendationsManager.forceCopyRecommendations()',
    'إنشاء تقرير': 'recommendationsManager.generateReport()',
    'تصدير البيانات': 'recommendationsManager.exportData()',
    'حذف جميع البيانات': 'recommendationsManager.clearAllData()',
    'عرض الإحصائيات': 'recommendationsManager.getQuickStats()'
});

