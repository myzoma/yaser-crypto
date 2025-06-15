// UT Bot Scanner - النظام الهجين الذكي
class UTBotScanner {
    constructor() {
        this.signals = [];
        this.isScanning = false;
        this.lastUpdate = null;
        this.scanInterval = null;
        this.config = {
            timeframes: ['1h', '4h', '1d'],
            minVolume: 1000000,
            rsiOverbought: 70,
            rsiOversold: 30,
            atrMultiplier: 2.5,
            riskRewardMin: 1.5
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startAutoScan();
        console.log('🔥 UT Bot Scanner initialized successfully');
    }

    setupEventListeners() {
        // Filter tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterSignals(e.target.dataset.filter);
                this.updateActiveTab(e.target);
            });
        });

        // Auto refresh every 12 minutes
        this.scanInterval = setInterval(() => {
            this.loadUTBotSignals();
        }, 12 * 60 * 1000);
    }

    async loadUTBotSignals() {
        if (this.isScanning) return;
        
        this.isScanning = true;
        this.showLoading();
        this.updateScanStatus('جاري الفحص...', 'scanning');

        try {
            // محاكاة تحميل البيانات
            await this.simulateDataLoading();
            
            // توليد إشارات تجريبية
            this.signals = await this.generateHybridSignals();
            
            // عرض النتائج
            this.displaySignals();
            this.updateStats();
            this.updateLastUpdateTime();
            
            this.showNotification('تم تحديث الإشارات بنجاح! 🎯', 'success');
            this.updateScanStatus('مكتمل', 'success');
            
        } catch (error) {
            console.error('Error loading signals:', error);
            this.showError('حدث خطأ في تحميل البيانات');
            this.updateScanStatus('خطأ', 'error');
        } finally {
            this.isScanning = false;
            this.hideLoading();
        }
    }

    async simulateDataLoading() {
        const steps = [
            'تحميل قائمة العملات...',
            'تحليل البيانات التقنية...',
            'حساب مؤشر ATR...',
            'فحص مستويات RSI...',
            'تحليل الحجم والسيولة...',
            'توليد الإشارات الهجينة...',
            'حساب الأهداف الديناميكية...'
        ];

        for (let i = 0; i < steps.length; i++) {
            document.getElementById('loadingStep').textContent = steps[i];
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

      async generateHybridSignals() {
        const symbols = [
            'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
            'SOLUSDT', 'DOTUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT',
            'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'FILUSDT', 'TRXUSDT'
        ];

        const signals = [];
        const signalCount = Math.floor(Math.random() * 8) + 3; // 3-10 signals

        for (let i = 0; i < signalCount; i++) {
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            const timeframe = this.config.timeframes[Math.floor(Math.random() * this.config.timeframes.length)];
            const signalType = Math.random() > 0.5 ? 'buy' : 'sell';
            
            const signal = await this.generateSignalData(symbol, timeframe, signalType);
            signals.push(signal);
        }

        return signals.filter(signal => signal.riskReward >= this.config.riskRewardMin);
    }

    async generateSignalData(symbol, timeframe, type) {
        // محاكاة بيانات السعر
        const basePrice = this.getRandomPrice(symbol);
        const currentPrice = basePrice * (1 + (Math.random() - 0.5) * 0.05);
        const priceChange = ((currentPrice - basePrice) / basePrice) * 100;

        // حساب ATR
        const atr = currentPrice * (Math.random() * 0.03 + 0.01);
        
        // حساب RSI
        const rsi = Math.random() * 100;
        
        // حساب الحجم
        const volume = Math.random() * 50000000 + 5000000;
        
        // حساب قوة الإشارة
        const strength = this.calculateSignalStrength(rsi, volume, atr, type);
        
        // حساب الأهداف
        const targets = this.calculateDynamicTargets(currentPrice, atr, type);
        
        // حساب نسبة المخاطرة للعائد
        const riskReward = Math.abs(targets.profitTarget - currentPrice) / Math.abs(currentPrice - targets.stopLoss);

        return {
            id: Date.now() + Math.random(),
            symbol: symbol,
            timeframe: timeframe,
            type: type,
            currentPrice: currentPrice,
            priceChange: priceChange,
            entryPrice: currentPrice,
            profitTarget: targets.profitTarget,
            stopLoss: targets.stopLoss,
            riskReward: riskReward,
            atr: atr,
            rsi: rsi,
            volume: volume,
            strength: strength,
            timestamp: new Date(),
            confidence: Math.random() * 30 + 70 // 70-100%
        };
    }

    getRandomPrice(symbol) {
        const prices = {
            'BTCUSDT': 45000 + Math.random() * 20000,
            'ETHUSDT': 2500 + Math.random() * 1000,
            'BNBUSDT': 300 + Math.random() * 200,
            'ADAUSDT': 0.4 + Math.random() * 0.6,
            'XRPUSDT': 0.5 + Math.random() * 0.3,
            'SOLUSDT': 80 + Math.random() * 60,
            'DOTUSDT': 6 + Math.random() * 4,
            'AVAXUSDT': 25 + Math.random() * 15,
            'MATICUSDT': 0.8 + Math.random() * 0.7,
            'LINKUSDT': 12 + Math.random() * 8
        };
        return prices[symbol] || 100 + Math.random() * 50;
    }

    calculateSignalStrength(rsi, volume, atr, type) {
        let strength = 50; // Base strength

        // RSI analysis
        if (type === 'buy' && rsi < 35) strength += 20;
        if (type === 'sell' && rsi > 65) strength += 20;
        if (rsi > 30 && rsi < 70) strength += 10; // Neutral zone

        // Volume analysis
        if (volume > 20000000) strength += 15;
        if (volume > 10000000) strength += 10;

        // ATR analysis (volatility)
        if (atr > 0.02) strength += 10; // High volatility
        
        return Math.min(Math.max(strength + (Math.random() * 20 - 10), 30), 95);
    }

    calculateDynamicTargets(price, atr, type) {
        const atrMultiplier = this.config.atrMultiplier;
        const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

        if (type === 'buy') {
            return {
                profitTarget: price + (atr * atrMultiplier * randomFactor),
                stopLoss: price - (atr * (atrMultiplier * 0.6) * randomFactor)
            };
        } else {
            return {
                profitTarget: price - (atr * atrMultiplier * randomFactor),
                stopLoss: price + (atr * (atrMultiplier * 0.6) * randomFactor)
            };
        }
    }

    displaySignals() {
        const container = document.getElementById('utBotSignals');
        const emptyState = document.getElementById('emptyState');

        if (this.signals.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = this.signals.map(signal => this.createSignalCard(signal)).join('');
        
        // Add animations
        container.querySelectorAll('.buy-signal-item, .sell-signal-item').forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
            card.classList.add('fade-in');
        });
    }

    createSignalCard(signal) {
        const cardClass = signal.type === 'buy' ? 'buy-signal-item' : 'sell-signal-item';
        const signalIcon = signal.type === 'buy' ? '📈' : '📉';
        const signalColor = signal.type === 'buy' ? 'var(--success-color)' : 'var(--danger-color)';
        const priceChangeClass = signal.priceChange >= 0 ? 'positive' : 'negative';
        const priceChangeIcon = signal.priceChange >= 0 ? '↗' : '↘';
        
        const riskRewardClass = signal.riskReward >= 2.5 ? 'excellent' : 
                               signal.riskReward >= 1.8 ? 'good' : 'poor';

        return `
            <div class="${cardClass}" data-signal-type="${signal.type}">
                <div class="signal-header">
                    <div>
                        <div class="signal-type" style="color: ${signalColor}">
                            ${signalIcon} ${signal.type === 'buy' ? 'شراء' : 'بيع'}
                        </div>
                        <strong>${signal.symbol}</strong>
                    </div>
                    <div class="price-info">
                        <div class="current-price">$${signal.currentPrice.toFixed(4)}</div>
                        <div class="price-change ${priceChangeClass}">
                            ${priceChangeIcon} ${Math.abs(signal.priceChange).toFixed(2)}%
                        </div>
                    </div>
                    <div class="timeframe-indicator">${signal.timeframe}</div>
                </div>

                <div class="targets-info">
                    <div class="target-item">
                        <span class="target-label">الهدف</span>
                        <span class="target-value profit-target">$${signal.profitTarget.toFixed(4)}</span>
                    </div>
                    <div class="target-item">
                        <span class="target-label">وقف الخسارة</span>
                        <span class="target-value stop-loss">$${signal.stopLoss.toFixed(4)}</span>
                    </div>
                    <div class="target-item">
                        <span class="target-label">نسبة المخاطرة</span>
                        <span class="target-value risk-reward ${riskRewardClass}">1:${signal.riskReward.toFixed(1)}</span>
                    </div>
                </div>

                <div class="hybrid-info">
                    <div class="info-item tooltip" data-tooltip="مؤشر القوة النسبية">
                        <span class="info-label">RSI</span>
                        <span class="info-value rsi-value">${signal.rsi.toFixed(1)}</span>
                    </div>
                    <div class="info-item tooltip" data-tooltip="متوسط المدى الحقيقي">
                        <span class="info-label">ATR</span>
                        <span class="info-value atr-value">${(signal.atr/signal.currentPrice*100).toFixed(2)}%</span>
                    </div>
                    <div class="info-item tooltip" data-tooltip="حجم التداول">
                        <span class="info-label">الحجم</span>
                        <span class="info-value volume-value">${this.formatVolume(signal.volume)}</span>
                    </div>
                    <div class="info-item tooltip" data-tooltip="قوة الإشارة">
                        <span class="info-label">القوة</span>
                        <span class="info-value strength-value">${signal.strength.toFixed(0)}%</span>
                    </div>
                    <div class="info-item tooltip" data-tooltip="مستوى الثقة">
                        <span class="info-label">الثقة</span>
                        <span class="info-value">${signal.confidence.toFixed(0)}%</span>
                    </div>
                    <div class="info-item tooltip" data-tooltip="وقت الإشارة">
                        <span class="info-label">الوقت</span>
                        <span class="info-value">${this.formatTime(signal.timestamp)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    formatVolume(volume) {
        if (volume >= 1000000) {
            return (volume / 1000000).toFixed(1) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'K';
        }
        return volume.toFixed(0);
    }

    formatTime(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'الآن';
        if (minutes < 60) return `${minutes}د`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}س`;
        
        return timestamp.toLocaleDateString('ar-SA');
    }

    updateStats() {
        const totalSignals = this.signals.length;
        const buySignals = this.signals.filter(s => s.type === 'buy').length;
        const sellSignals = this.signals.filter(s => s.type === 'sell').length;

        document.getElementById('totalSignals').textContent = totalSignals;
        document.getElementById('buySignals').textContent = buySignals;
        document.getElementById('sellSignals').textContent = sellSignals;

        // Animate counters
        this.animateCounter('totalSignals', totalSignals);
        this.animateCounter('buySignals', buySignals);
        this.animateCounter('sellSignals', sellSignals);
    }

    animateCounter(elementId, targetValue) {
        const element = document.getElementById(elementId);
        const startValue = 0;
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
            
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    filterSignals(filter) {
        const cards = document.querySelectorAll('.buy-signal-item, .sell-signal-item');
        
        cards.forEach(card => {
            const signalType = card.dataset.signalType;
            
            if (filter === 'all' || filter === signalType) {
                card.style.display = 'block';
                card.classList.add('fade-in');
            } else {
                card.style.display = 'none';
            }
        });
    }

    updateActiveTab(activeTab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        activeTab.classList.add('active');
    }

    showLoading() {
        document.getElementById('loadingContainer').style.display = 'block';
        document.getElementById('utBotSignals').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('utBotSignals').style.display = 'grid';
    }

    updateScanStatus(status, type = 'success') {
        const statusElement = document.getElementById('scanStatus');
        const statusDot = document.getElementById('statusDot');
        
        statusElement.textContent = status;
        
        statusDot.className = 'status-dot';
        if (type === 'scanning') {
            statusDot.style.background = 'var(--warning-color)';
        } else if (type === 'error') {
            statusDot.style.background = 'var(--danger-color)';
        } else {
            statusDot.style.background = 'var(--success-color)';
        }
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('lastUpdate').textContent = timeString;
        this.lastUpdate = now;
    }

    showNotification(message, type = 'info') {
        // إنشاء عنصر الإشعار
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // إضافة الإشعار للصفحة
        document.body.appendChild(notification);
        
        // إظهار الإشعار
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // إخفاء الإشعار بعد 4 ثواني
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 4000);
    }

    showError(message) {
        const container = document.getElementById('utBotSignals');
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <div class="error-message">حدث خطأ في النظام</div>
                <div class="error-details">${message}</div>
                <button class="retry-btn" onclick="utBotScanner.loadUTBotSignals()">
                    🔄 إعادة المحاولة
                </button>
            </div>
        `;
    }

    startAutoScan() {
        // بدء الفحص التلقائي كل 12 دقيقة
        this.loadUTBotSignals();
    }

    stopAutoScan() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
    }

    // إعدادات متقدمة
    updateHybridSettings() {
        this.showNotification('إعدادات النظام الهجين قيد التطوير 🔧', 'info');
    }

    // معلومات النظام
    showSystemInfo() {
        const info = `
            📊 معلومات النظام الهجين:
            • الإصدار: 2.1.0
            • آخر تحديث: ${this.lastUpdate ? this.lastUpdate.toLocaleString('ar-SA') : 'غير متوفر'}
            • عدد الإشارات النشطة: ${this.signals.length}
            • حالة النظام: ${this.isScanning ? 'جاري الفحص' : 'جاهز'}
        `;
        this.showNotification(info, 'info');
    }

    // تصدير البيانات
    exportSignals() {
        if (this.signals.length === 0) {
            this.showNotification('لا توجد إشارات للتصدير', 'error');
            return;
        }

        const dataStr = JSON.stringify(this.signals, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `ut-bot-signals-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showNotification('تم تصدير الإشارات بنجاح! 📁', 'success');
    }

    // تنظيف الذاكرة
    cleanup() {
        this.stopAutoScan();
        this.signals = [];
        console.log('UT Bot Scanner cleaned up');
    }
}

// إنشاء مثيل من الماسح الضوئي
const utBotScanner = new UTBotScanner();

// الدوال العامة للواجهة
function loadUTBotSignals() {
    utBotScanner.loadUTBotSignals();
}

function updateHybridSettings() {
    utBotScanner.updateHybridSettings();
}

function showSystemInfo() {
    utBotScanner.showSystemInfo();
}

function exportSignals() {
    utBotScanner.exportSignals();
}

// تنظيف عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    utBotScanner.cleanup();
});

// معالجة الأخطاء العامة
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    utBotScanner.showNotification('حدث خطأ غير متوقع في النظام', 'error');
});

// تصدير للاستخدام العام
window.utBotScanner = utBotScanner;

