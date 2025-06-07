class YaserCryptoTracker {
    constructor() {
        this.signals = JSON.parse(localStorage.getItem('yaserSignals')) || [];
        this.currentPage = 1;
        this.signalsPerPage = 10;
        this.currentFilter = 'all';
        this.sourceUrl = 'https://myzoma.github.io/yaser-crypto/';
        this.yaserCrypto = null;
        
        this.init();
        this.startAutoUpdate();
    }

    init() {
        this.bindEvents();
        this.loadSignalsFromSource();
        this.updateStats();
        this.renderSignals();
        this.updateLastUpdateTime();
    }

    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadSignalsFromSource());
        document.getElementById('dailyReportBtn').addEventListener('click', () => this.showDailyReport());
        
        // Filter tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.currentPage = 1;
                this.renderSignals();
            });
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderSignals();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            const totalPages = Math.ceil(this.getFilteredSignals().length / this.signalsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderSignals();
            }
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('reportModal').style.display = 'none';
        });
    }

    async loadSignalsFromSource() {
        try {
            this.updateConnectionStatus('🔄 جاري تحميل البيانات من المصدر...', 'loading');
            
            // إنشاء iframe مخفي للوصول لموقعك
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = this.sourceUrl;
            
            return new Promise((resolve, reject) => {
                iframe.onload = async () => {
                    try {
                        // انتظار تحميل البيانات
                        await this.delay(3000);
                        
                        // محاولة الوصول لكائن YaserCrypto
                        const iframeWindow = iframe.contentWindow;
                        
                        if (iframeWindow && iframeWindow.yaserCrypto) {
                            const coins = iframeWindow.yaserCrypto.coins;
                            
                            if (coins && coins.length > 0) {
                                // أخذ أول 12 عملة
                                const top12Coins = coins.slice(0, 12);
                                const newSignals = this.convertCoinsToSignals(top12Coins);
                                
                                this.mergeNewSignals(newSignals);
                                this.updateSignalsPrices();
                                this.saveSignals();
                                this.updateStats();
                                this.renderSignals();
                                this.updateConnectionStatus('✅ تم التحديث بنجاح', 'success');
                                resolve();
                            } else {
                                throw new Error('لم يتم العثور على بيانات العملات');
                            }
                        } else {
                            // محاولة بديلة - البحث في DOM
                            await this.extractFromDOM(iframe);
                            resolve();
                        }
                    } catch (error) {
                        console.error('خطأ في تحميل البيانات:', error);
                        this.updateConnectionStatus('❌ خطأ في الاتصال بالمصدر', 'error');
                        reject(error);
                    } finally {
                        document.body.removeChild(iframe);
                    }
                };
                
                iframe.onerror = () => {
                    this.updateConnectionStatus('❌ فشل في تحميل المصدر', 'error');
                    document.body.removeChild(iframe);
                    reject(new Error('فشل في تحميل iframe'));
                };
                
                document.body.appendChild(iframe);
            });
            
        } catch (error) {
            console.error('خطأ في loadSignalsFromSource:', error);
            this.updateConnectionStatus('❌ خطأ في الاتصال', 'error');
        }
        
        this.updateLastUpdateTime();
    }

    async extractFromDOM(iframe) {
        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            
            // البحث عن عناصر العملات في الصفحة
            const coinElements = doc.querySelectorAll('.coin-card, .signal-card, [data-coin]');
            
            if (coinElements.length === 0) {
                // محاولة البحث في coinsGrid
                const coinsGrid = doc.getElementById('coinsGrid');
                if (coinsGrid) {
                    const coins = this.parseCoinsFromGrid(coinsGrid);
                    if (coins.length > 0) {
                        const newSignals = this.convertCoinsToSignals(coins.slice(0, 12));
                        this.mergeNewSignals(newSignals);
                        this.updateSignalsPrices();
                        this.saveSignals();
                        this.updateStats();
                        this.renderSignals();
                        this.updateConnectionStatus('✅ تم التحديث من DOM', 'success');
                        return;
                    }
                }
                throw new Error('لم يتم العثور على عناصر العملات');
            }
            
            const signals = [];
            coinElements.forEach((element, index) => {
                if (index < 12) { // أول 12 فقط
                    const signal = this.extractSignalFromElement(element, index + 1);
                    if (signal) signals.push(signal);
                }
            });
            
            if (signals.length > 0) {
                this.mergeNewSignals(signals);
                this.updateSignalsPrices();
                this.saveSignals();
                this.updateStats();
                this.renderSignals();
                this.updateConnectionStatus('✅ تم التحديث من DOM', 'success');
            } else {
                throw new Error('لم يتم استخراج أي توصيات');
            }
            
        } catch (error) {
            console.error('خطأ في extractFromDOM:', error);
            this.updateConnectionStatus('⚠️ فشل في استخراج البيانات', 'warning');
        }
    }

    parseCoinsFromGrid(coinsGrid) {
        const coins = [];
        const coinCards = coinsGrid.children;
        
        for (let card of coinCards) {
            try {
                const coinData = this.parseCoinCard(card);
                if (coinData) coins.push(coinData);
            } catch (error) {
                console.log('خطأ في تحليل بطاقة العملة:', error);
            }
        }
        
        return coins;
    }

    parseCoinCard(card) {
        try {
            const text = card.textContent || card.innerText;
            
            // استخراج اسم العملة
            const symbolMatch = text.match(/([A-Z]{3,10})/);
            if (!symbolMatch) return null;
            
            const symbol = symbolMatch[1];
            
            // استخراج السعر والتغيير
            const numbers = text.match(/[\d.]+/g);
            if (!numbers || numbers.length < 2) return null;
            
            const price = parseFloat(numbers[0]);
            const change24h = parseFloat(numbers[1]);
            
            return {
                symbol: symbol,
                price: price,
                change24h: change24h,
                technicalIndicators: {
                    fibonacci: {
                        level236: price * 1.02,
                        level382: price * 1.04,
                        level500: price * 1.06,
                        level786: price * 0.98
                    }
                }
            };
        } catch (error) {
            console.error('خطأ في parseCoinCard:', error);
            return null;
        }
    }

    convertCoinsToSignals(coins) {
        return coins.map((coin, index) => {
            const entryPrice = coin.price;
            const fib = coin.technicalIndicators?.fibonacci;
            
            return {
                id: `${coin.symbol}_${index + 1}_${Date.now()}`,
                rank: index + 1,
                coinName: coin.symbol,
                entryPoint: entryPrice,
                stopLoss: fib?.level786 || entryPrice * 0.95,
                target1: fib?.level236 || entryPrice * 1.03,
                target2: fib?.level382 || entryPrice * 1.06,
                target3: fib?.level500 || entryPrice * 1.10,
                status: 'active',
                achievedTargets: [],
                currentPrice: entryPrice,
                profit: 0,
                createdAt: new Date().toISOString(),
                isPinned: false,
                change24h: coin.change24h || 0
            };
        });
    }

    mergeNewSignals(newSignals) {
        // إضافة التوصيات الجديدة في المقدمة
        const existingSymbols = this.signals.map(s => s.coinName);
        
        newSignals.forEach(newSignal => {
            const existingIndex = this.signals.findIndex(s => 
                s.coinName === newSignal.coinName && 
                Math.abs(new Date(s.createdAt) - new Date()) < 24 * 60 * 60 * 1000 // خلال 24 ساعة
            );
            
            if (existingIndex === -1) {
                // توصية جديدة
                this.signals.unshift(newSignal);
            } else {
                // تحديث التوصية الموجودة
                const existing = this.signals[existingIndex];
                newSignal.status = existing.status;
                newSignal.achievedTargets = existing.achievedTargets;
                newSignal.isPinned = existing.isPinned;
                newSignal.createdAt = existing.createdAt;
                                this.signals[existingIndex] = newSignal;
            }
        });
    }

    async updateSignalsPrices() {
        for (let signal of this.signals) {
            if (signal.status === 'active') {
                try {
                    // محاولة الحصول على السعر الحالي من OKX API (نفس المصدر المستخدم في موقعك)
                    const price = await this.getCurrentPriceFromOKX(signal.coinName);
                    if (price) {
                        signal.currentPrice = price;
                        this.updateSignalStatus(signal);
                    }
                } catch (error) {
                    console.log(`خطأ في تحديث سعر ${signal.coinName}:`, error);
                }
            }
        }
    }

    async getCurrentPriceFromOKX(symbol) {
        try {
            const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                    return parseFloat(data.data[0].last);
                }
            }
        } catch (error) {
            console.log(`خطأ في جلب سعر ${symbol} من OKX:`, error);
        }
        return null;
    }

    updateSignalStatus(signal) {
        const currentPrice = signal.currentPrice;
        const entryPrice = signal.entryPoint;
        
        // حساب الربح/الخسارة
        signal.profit = ((currentPrice - entryPrice) / entryPrice) * 100;
        
        // فحص وقف الخسارة
        if (currentPrice <= signal.stopLoss) {
            signal.status = 'failed';
            return;
        }
        
        // فحص الأهداف
        const targets = ['target1', 'target2', 'target3'];
        signal.achievedTargets = [];
        
        targets.forEach((target, index) => {
            if (currentPrice >= signal[target]) {
                signal.achievedTargets.push(index + 1);
            }
        });
        
        // إذا تحققت 3 أهداف
        if (signal.achievedTargets.length === 3) {
            signal.status = 'success';
            signal.isPinned = true; // تثبيت تلقائي للتوصيات الناجحة
        }
    }

    getFilteredSignals() {
        let filtered = [...this.signals];
        
        switch (this.currentFilter) {
            case 'active':
                filtered = filtered.filter(s => s.status === 'active');
                break;
            case 'success':
                filtered = filtered.filter(s => s.status === 'success');
                break;
            case 'failed':
                filtered = filtered.filter(s => s.status === 'failed');
                break;
            case 'pinned':
                filtered = filtered.filter(s => s.isPinned);
                break;
        }
        
        return filtered;
    }

    renderSignals() {
        const signalsList = document.getElementById('signalsList');
        const filteredSignals = this.getFilteredSignals();
        
        if (filteredSignals.length === 0) {
            signalsList.innerHTML = '<div class="no-signals">لا توجد توصيات لعرضها</div>';
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.signalsPerPage;
        const endIndex = startIndex + this.signalsPerPage;
        const pageSignals = filteredSignals.slice(startIndex, endIndex);
        
        signalsList.innerHTML = pageSignals.map(signal => this.createSignalCard(signal)).join('');
        
        // تحديث معلومات الصفحة
        const totalPages = Math.ceil(filteredSignals.length / this.signalsPerPage);
        document.getElementById('pageInfo').textContent = `صفحة ${this.currentPage} من ${totalPages}`;
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === totalPages;
        
        // ربط أحداث التثبيت
        this.bindPinEvents();
    }

    createSignalCard(signal) {
        const statusClass = signal.status === 'success' ? 'success' : 
                           signal.status === 'failed' ? 'failed' : 'active';
        
        const statusText = signal.status === 'success' ? 'ناجحة' : 
                          signal.status === 'failed' ? 'فشلت' : 'نشطة';
        
        const profitColor = signal.profit > 0 ? '#4caf50' : signal.profit < 0 ? '#f44336' : '#ffd700';
        
        const targetsHtml = [1, 2, 3].map(targetNum => {
            const achieved = signal.achievedTargets.includes(targetNum);
            return `
                <div class="target ${achieved ? 'achieved' : ''}">
                    <div class="target-label">هدف ${targetNum}</div>
                    <div class="target-value">${signal[`target${targetNum}`].toFixed(6)}</div>
                    ${achieved ? '<div class="target-check">✓</div>' : ''}
                </div>
            `;
        }).join('');
        
        return `
            <div class="signal-card ${statusClass} ${signal.isPinned ? 'pinned' : ''}" data-id="${signal.id}">
                <div class="signal-header">
                    <div class="coin-info">
                        <div class="coin-name">${signal.coinName}</div>
                        <div class="coin-rank">المركز #${signal.rank}</div>
                    </div>
                    <div class="signal-status status-${signal.status}">${statusText}</div>
                </div>
                
                <div class="signal-details">
                    <div class="detail-item">
                        <div class="detail-label">نقطة الدخول</div>
                        <div class="detail-value">${signal.entryPoint.toFixed(6)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">السعر الحالي</div>
                        <div class="detail-value">${signal.currentPrice ? signal.currentPrice.toFixed(6) : '--'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">وقف الخسارة</div>
                        <div class="detail-value">${signal.stopLoss.toFixed(6)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">الربح/الخسارة</div>
                        <div class="detail-value" style="color: ${profitColor}">
                            ${signal.profit.toFixed(2)}%
                        </div>
                    </div>
                </div>
                
                <div class="targets">
                    ${targetsHtml}
                </div>
                
                <div class="signal-footer">
                    <div class="signal-time">
                        ${new Date(signal.createdAt).toLocaleString('ar-SA')}
                    </div>
                    <div class="signal-actions">
                        <button class="action-btn pin-btn" data-id="${signal.id}">
                            ${signal.isPinned ? '📌 مثبت' : '📌 تثبيت'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    bindPinEvents() {
        document.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const signalId = e.target.dataset.id;
                this.togglePin(signalId);
            });
        });
    }

    togglePin(signalId) {
        const signal = this.signals.find(s => s.id === signalId);
        if (signal) {
            signal.isPinned = !signal.isPinned;
            this.saveSignals();
            this.renderSignals();
        }
    }

    updateStats() {
        const total = this.signals.length;
        const success = this.signals.filter(s => s.status === 'success').length;
        const failed = this.signals.filter(s => s.status === 'failed').length;
        
        // حساب نسبة الربح الإجمالي
        const totalProfit = this.signals.reduce((sum, signal) => {
            if (signal.status === 'success') {
                return sum + Math.max(signal.profit, 0);
            }
            return sum;
        }, 0);
        
        const totalLoss = this.signals.reduce((sum, signal) => {
            if (signal.status === 'failed') {
                return sum + Math.abs(Math.min(signal.profit, 0));
            }
            return sum;
        }, 0);
        
        const netProfit = totalProfit - totalLoss;
        
        document.getElementById('totalSignals').textContent = total;
        document.getElementById('successSignals').textContent = success;
        document.getElementById('failedSignals').textContent = failed;
        document.getElementById('totalProfit').textContent = `${netProfit.toFixed(2)}%`;
    }

    showDailyReport() {
        const modal = document.getElementById('reportModal');
        const reportContent = document.getElementById('reportContent');
        
        // فلترة التوصيات خلال آخر 24 ساعة
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailySignals = this.signals.filter(s => new Date(s.createdAt) >= last24Hours);
        
        const dailySuccess = dailySignals.filter(s => s.status === 'success').length;
        const dailyFailed = dailySignals.filter(s => s.status === 'failed').length;
        const dailyActive = dailySignals.filter(s => s.status === 'active').length;
        
        const dailyProfit = dailySignals.reduce((sum, signal) => {
            return sum + (signal.status === 'success' ? signal.profit : 0);
        }, 0);
        
        reportContent.innerHTML = `
            <div class="report-stats">
                <h4>📊 إحصائيات آخر 24 ساعة</h4>
                <div class="report-grid">
                    <div class="report-item">
                        <div class="report-number">${dailySignals.length}</div>
                        <div class="report-label">إجمالي التوصيات</div>
                    </div>
                    <div class="report-item success">
                        <div class="report-number">${dailySuccess}</div>
                        <div class="report-label">ناجحة</div>
                    </div>
                    <div class="report-item failed">
                        <div class="report-number">${dailyFailed}</div>
                        <div class="report-label">فاشلة</div>
                    </div>
                    <div class="report-item active">
                        <div class="report-number">${dailyActive}</div>
                        <div class="report-label">نشطة</div>
                    </div>
                </div>
                <div class="report-profit">
                    <h5>الربح الإجمالي: <span style="color: ${dailyProfit > 0 ? '#4caf50' : '#f44336'}">${dailyProfit.toFixed(2)}%</span></h5>
                </div>
            </div>
            
            <div class="report-details">
                <h4>📈 تفاصيل التوصيات</h4>
                ${dailySignals.map(signal => `
                    <div class="report-signal">
                        <span class="signal-name">${signal.coinName}</span>
                        <span class="signal-profit" style="color: ${signal.profit > 0 ? '#4caf50' : '#f44336'}">
                            ${signal.profit.toFixed(2)}%
                        </span>
                        <span class="signal-status-report status-${signal.status}">
                            ${signal.status === 'success' ? 'ناجحة' : signal.status === 'failed' ? 'فشلت' : 'نشطة'}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
        
        modal.style.display = 'block';
    }

    startAutoUpdate() {
        // تحديث كل 6 ساعات
        setInterval(() => {
            this.loadSignalsFromSource();
        }, 6 * 60 * 60 * 1000);
        
        // تحديث الأسعار كل 5 دقائق
        setInterval(() => {
            this.updateSignalsPrices();
            this.saveSignals();
            this.updateStats();
            this.renderSignals();
        }, 5 * 60 * 1000);
        
        // تقرير يومي كل 24 ساعة
        setInterval(() => {
            console.log('تقرير يومي تلقائي:', this.generateDailyReport());
        }, 24 * 60 * 60 * 1000);
    }

    generateDailyReport() {
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dailySignals = this.signals.filter(s => new Date(s.createdAt) >= last24Hours);
        
        return {
            total: dailySignals.length,
            success: dailySignals.filter(s => s.status === 'success').length,
            failed: dailySignals.filter(s => s.status === 'failed').length,
            active: dailySignals.filter(s => s.status === 'active').length,
            totalProfit: dailySignals.reduce((sum, s) => sum + (s.status === 'success' ? s.profit : 0), 0)
        };
    }

    saveSignals() {
        localStorage.setItem('yaserSignals', JSON.stringify(this.signals));
    }

    updateConnectionStatus(message, type) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = message;
        statusElement.className = `connection-status ${type}`;
    }

    updateLastUpdateTime() {
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('ar-SA');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', () => {
    new YaserCryptoTracker();
});

// إضافة دعم للنقر خارج النافذة المنبثقة لإغلاقها
window.addEventListener('click', (event) => {
    const modal = document.getElementById('reportModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});


