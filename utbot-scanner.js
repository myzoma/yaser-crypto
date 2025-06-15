class UTBotScanner {
    constructor() {
   this.dataSources = {
        binance: {
            base: 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://api1.binance.com/api/v3'),
            direct: 'https://api1.binance.com/api/v3'
        },
        okx: {
            base: 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.okx.com/api/v5'),
            direct: 'https://www.okx.com/api/v5',
            // ضع مفاتيح OKX هنا
            apiKey: 'b20c667d-ae40-48a6-93f4-a11a64185068',
            secretKey: 'BD7C76F71D1A4E01B4C7E1A23B620365',
            passphrase: '212160Nm$#'
        }
    };
        this.symbols = [];
        this.isScanning = false;
        this.requestDelay = 200; // تأخير بين الطلبات
        this.maxConcurrent = 5; // حد أقصى للطلبات المتزامنة
        
        this.targetSettings = {
            baseATRMultiplier: 3.0,
            baseStopMultiplier: 1.4,
            atrPeriod: 14,
            volumePeriod: 20,
            minVolumeRatio: 0.8,
            minRiskReward: 1.8
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🚀 تهيئة UT Bot Scanner...');
        this.updateStatus('جاري التهيئة...', '#ff9800');
        this.startAutoScan();
    }

    updateStatus(message, color = '#4CAF50') {
        const statusElement = document.querySelector('.scan-status span');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = color;
        }
    }

    // تأخير بين الطلبات لتجنب Rate Limit
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

   async fetchTopSymbols() {
    try {
        console.log('📊 جاري جلب قائمة العملات من مصادر متعددة...');
        this.updateStatus('جلب قائمة العملات...', '#ff9800');
        
        const [binanceSymbols, okxSymbols] = await Promise.allSettled([
            this.fetchBinanceSymbols(),
            this.fetchOKXSymbols()
        ]);
        
        let allSymbols = [];
        
        if (binanceSymbols.status === 'fulfilled') {
            allSymbols.push(...binanceSymbols.value);
        }
        
        if (okxSymbols.status === 'fulfilled') {
            allSymbols.push(...okxSymbols.value);
        }
        
        // إزالة المكررات وترتيب حسب الحجم
        const uniqueSymbols = [...new Set(allSymbols)];
        this.symbols = uniqueSymbols.slice(0, 50);
        
        console.log(`✅ تم تحميل ${this.symbols.length} عملة من مصادر متعددة`);
        return this.symbols;
    } catch (error) {
        console.error('❌ خطأ في جلب العملات:', error);
        this.updateStatus('خطأ في جلب البيانات', '#f44336');
        return [];
    }
}
// إضافة بعد دالة fetchTopSymbols
async fetchBinanceSymbols() {
    try {
        const binanceUrl = 'https://api1.binance.com/api/v3/ticker/24hr';
        const proxyUrl = this.dataSources.binance.base.replace(encodeURIComponent('https://api1.binance.com/api/v3'), '') + encodeURIComponent(binanceUrl);
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const tickers = JSON.parse(data.contents);
        
        return tickers
            .filter(ticker => 
                ticker.symbol.endsWith('USDT') &&
                parseFloat(ticker.quoteVolume) > 10000000
            )
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 25)
            .map(ticker => ticker.symbol);
    } catch (error) {
        console.error('❌ خطأ Binance:', error);
        return [];
    }
}

async fetchOKXSymbols() {
    try {
        const okxUrl = 'https://www.okx.com/api/v5/market/tickers?instType=SPOT';
        const proxyUrl = this.dataSources.okx.base.replace(encodeURIComponent('https://www.okx.com/api/v5'), '') + encodeURIComponent(okxUrl);
        
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const result = JSON.parse(data.contents);
        
        return result.data
            .filter(ticker => 
                ticker.instId.endsWith('-USDT') &&
                parseFloat(ticker.volCcy24h) > 5000000
            )
            .sort((a, b) => parseFloat(b.volCcy24h) - parseFloat(a.volCcy24h))
            .slice(0, 25)
            .map(ticker => ticker.instId.replace('-', ''));
    } catch (error) {
        console.error('❌ خطأ OKX:', error);
        return [];
    }
}


    async fetchKlines(symbol, interval, limit = 100) {
    // جرب Binance أولاً
    const binanceData = await this.fetchBinanceKlines(symbol, interval, limit);
    if (binanceData) return binanceData;
    
    // إذا فشل، جرب OKX
    const okxData = await this.fetchOKXKlines(symbol, interval, limit);
    return okxData;
}

async fetchBinanceKlines(symbol, interval, limit) {
    try {
        await this.delay(this.requestDelay);
        const response = await fetch(
            `${this.dataSources.binance.base}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) return null;
        
        const klines = await response.json();
        return klines.map(k => ({
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            hl2: (parseFloat(k[2]) + parseFloat(k[3])) / 2
        }));
    } catch (error) {
        return null;
    }
}

async fetchOKXKlines(symbol, interval, limit) {
    try {
        await this.delay(this.requestDelay);
        const okxSymbol = symbol.replace('USDT', '-USDT');
        const okxInterval = this.convertIntervalToOKX(interval);
        
        const url = `${this.dataSources.okx.base}/market/candles?instId=${okxSymbol}&bar=${okxInterval}&limit=${limit}`;
        const response = await fetch(url);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const result = JSON.parse(data.contents);
        
        return result.data.map(k => ({
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            hl2: (parseFloat(k[2]) + parseFloat(k[3])) / 2
        }));
    } catch (error) {
        return null;
    }
}

convertIntervalToOKX(binanceInterval) {
    const mapping = {
        '1h': '1H',
        '4h': '4H',
        '1d': '1D'
    };
    return mapping[binanceInterval] || '1H';
}


    calculateATR(candles, period = 14) {
        if (candles.length < period + 1) return 0;
        
        let atrSum = 0;
        for (let i = 1; i <= period; i++) {
            const current = candles[candles.length - i];
            const previous = candles[candles.length - i - 1];
            
            const tr = Math.max(
                current.high - current.low,
                Math.abs(current.high - previous.close),
                Math.abs(current.low - previous.close)
            );
            atrSum += tr;
        }
        return atrSum / period;
    }

    calculateRSI(candles, period = 14) {
        if (candles.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = candles.length - period; i < candles.length; i++) {
            const change = candles[i].close - candles[i - 1].close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateAverageVolume(candles, period = 20) {
        if (candles.length < period) return 0;
        
        let volumeSum = 0;
        for (let i = candles.length - period; i < candles.length; i++) {
            volumeSum += candles[i].volume;
        }
        return volumeSum / period;
    }

    formatPrice(price) {
        if (price < 0.000001) return price.toFixed(10);
        if (price < 0.001) return price.toFixed(8);
        if (price < 1) return price.toFixed(6);
        if (price < 100) return price.toFixed(4);
        return price.toFixed(2);
    }

    async checkUTBotSignal(symbol, interval) {
        try {
            const candles = await this.fetchKlines(symbol, interval);
            if (!candles || candles.length < 50) return null;

            const atr = this.calculateATR(candles);
            const rsi = this.calculateRSI(candles);
            const avgVolume = this.calculateAverageVolume(candles);
            const currentVolume = candles[candles.length - 1].volume;
            
            const keyValue = 0.8;
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            
            const upperBand = current.hl2 + (atr * keyValue);
            const lowerBand = current.hl2 - (atr * keyValue);
            
            const isBuySignal = current.close > upperBand && previous.close <= upperBand;
            const isSellSignal = current.close < lowerBand && previous.close >= lowerBand;
            
            if (isBuySignal || isSellSignal) {
                const signalType = isBuySignal ? 'BUY' : 'SELL';
                const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
                
                if (volumeRatio < 0.8) return null;

                const profitTarget = signalType === 'BUY' 
                    ? current.close + (atr * 3.0)
                    : current.close - (atr * 3.0);
                
                const stopLoss = signalType === 'BUY'
                    ? current.close - (atr * 1.4)
                    : current.close + (atr * 1.4);

                const riskAmount = Math.abs(current.close - stopLoss);
                const rewardAmount = Math.abs(current.close - profitTarget);
                const riskReward = riskAmount > 0 ? rewardAmount / riskAmount : 0;

                if (riskReward < 1.8) return null;

                return {
                    symbol: symbol,
                    price: this.formatPrice(current.close),
                    timeframe: interval,
                    signalType: signalType,
                    profitTarget: this.formatPrice(profitTarget),
                    stopLoss: this.formatPrice(stopLoss),
                    riskReward: riskReward,
                    rsi: rsi,
                    atr: atr,
                    volumeRatio: volumeRatio,
                    timestamp: Date.now()
                };
            }
            
            return null;
        } catch (error) {
            console.error(`❌ خطأ في فحص ${symbol}:`, error);
            return null;
        }
    }

    async loadUTBotSignals() {
        if (this.isScanning) {
            console.log('⏳ الفحص جاري بالفعل...');
            return;
        }

        this.isScanning = true;
        this.showLoading();
        
        try {
            console.log('🔍 بدء فحص إشارات UT Bot...');
            this.updateStatus('جاري الفحص...', '#ff9800');
            
            if (this.symbols.length === 0) {
                await this.fetchTopSymbols();
            }

            const intervals = ['1h', '4h'];
            const allSignals = [];
            
            for (const interval of intervals) {
                console.log(`📊 فحص الإطار الزمني ${interval}...`);
                
                             // معالجة متسلسلة لتجنب Rate Limit
                for (let i = 0; i < this.symbols.length; i += this.maxConcurrent) {
                    const batch = this.symbols.slice(i, i + this.maxConcurrent);
                    const promises = batch.map(symbol => this.checkUTBotSignal(symbol, interval));
                    
                    const results = await Promise.allSettled(promises);
                    const signals = results
                        .filter(result => result.status === 'fulfilled' && result.value)
                        .map(result => result.value);
                    
                    allSignals.push(...signals);
                    
                    // تأخير بين المجموعات
                    if (i + this.maxConcurrent < this.symbols.length) {
                        await this.delay(1000);
                    }
                }
                
                console.log(`✅ ${interval}: وُجد ${allSignals.filter(s => s.timeframe === interval).length} إشارة`);
            }

            // ترتيب الإشارات حسب نسبة المخاطرة والحجم
            const sortedSignals = allSignals
                .sort((a, b) => (b.riskReward * b.volumeRatio) - (a.riskReward * a.volumeRatio))
                .slice(0, 6); // أفضل 6 إشارات

            console.log(`🎯 إجمالي الإشارات المختارة: ${sortedSignals.length}`);
            
            this.displaySignals(sortedSignals);
            this.updateStats(sortedSignals);
            this.updateStatus('نشط', '#4CAF50');
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الإشارات:', error);
            this.showError('حدث خطأ في تحميل الإشارات');
            this.updateStatus('خطأ', '#f44336');
        } finally {
            this.isScanning = false;
            this.hideLoading();
        }
    }

    showLoading() {
        const container = document.getElementById('signals-container');
        if (container) {
            container.innerHTML = `
                <div class="ut-bot-loading">
                    <div class="loading-spinner"></div>
                    <h3>🔍 جاري فحص الأسواق...</h3>
                    <p>البحث عن أفضل الإشارات الهجينة</p>
                </div>
            `;
        }

        // تعطيل زر الفحص
        const scanBtn = document.getElementById('manual-scan-btn');
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الفحص...';
        }
    }

    hideLoading() {
        // تفعيل زر الفحص
        const scanBtn = document.getElementById('manual-scan-btn');
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '<i class="fas fa-search"></i> فحص يدوي';
        }
    }

    showError(message) {
        const container = document.getElementById('signals-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>خطأ في التحميل</h3>
                    <p>${message}</p>
                    <button onclick="utbotScanner.loadUTBotSignals()" class="retry-btn">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </div>
            `;
        }
    }

    displaySignals(signals) {
        const container = document.getElementById('signals-container');
        if (!container) {
            console.error('❌ لم يتم العثور على حاوي الإشارات');
            return;
        }

        if (signals.length === 0) {
            container.innerHTML = `
                <div class="no-signals">
                    <i class="fas fa-search"></i>
                    <h3>لا توجد إشارات حالياً</h3>
                    <p>لم يتم العثور على إشارات تتوافق مع المعايير المحددة</p>
                    <small>سيتم البحث مرة أخرى خلال 15 دقيقة</small>
                </div>
            `;
            return;
        }

        const signalsHTML = signals.map(signal => {
            const signalClass = signal.signalType === 'BUY' ? 'buy-signal-item' : 'sell-signal-item';
            const signalColor = signal.signalType === 'BUY' ? '#4CAF50' : '#f44336';
            const signalIcon = signal.signalType === 'BUY' ? 'fa-arrow-up' : 'fa-arrow-down';
            
            // حساب نسبة الربح/الخسارة المتوقعة
            const profitPercent = signal.signalType === 'BUY' 
                ? ((parseFloat(signal.profitTarget) - parseFloat(signal.price)) / parseFloat(signal.price) * 100)
                : ((parseFloat(signal.price) - parseFloat(signal.profitTarget)) / parseFloat(signal.price) * 100);
            
            const lossPercent = signal.signalType === 'BUY'
                ? ((parseFloat(signal.price) - parseFloat(signal.stopLoss)) / parseFloat(signal.price) * 100)
                : ((parseFloat(signal.stopLoss) - parseFloat(signal.price)) / parseFloat(signal.price) * 100);

            return `
                <div class="${signalClass}">
                    <div class="signal-header">
                        <div class="timeframe-indicator">${signal.timeframe.toUpperCase()}</div>
                        <strong>${signal.symbol}</strong>
                        <span style="color: ${signalColor}; font-weight: bold;">
                            <i class="fas ${signalIcon}"></i> ${signal.signalType}
                        </span>
                    </div>
                    
                    <div class="signal-price">
                        <span style="font-weight: bold; font-size: 1.2em;">السعر: $${signal.price}</span>
                    </div>
                    
                    <div class="targets-info">
                        <div style="margin-bottom: 8px;">
                            <span style="font-weight: bold;">🎯 الهدف:</span>
                            <span style="color: #4CAF50; font-weight: bold;">$${signal.profitTarget}</span>
                            <span style="color: #4CAF50;">(+${profitPercent.toFixed(2)}%)</span>
                        </div>
                        <div style="margin-bottom: 8px;">
                            <span style="font-weight: bold;">🛑 الستوب:</span>
                            <span style="color: #f44336; font-weight: bold;">$${signal.stopLoss}</span>
                            <span style="color: #f44336;">(-${lossPercent.toFixed(2)}%)</span>
                        </div>
                        <div>
                            <span style="font-weight: bold;">⚖️ نسبة المخاطرة:</span>
                            <span style="color: #FF9800; font-weight: bold;">${signal.riskReward.toFixed(2)}:1</span>
                        </div>
                    </div>
                    
                    <div class="hybrid-info">
                        <span>📊 RSI: <strong>${signal.rsi.toFixed(1)}</strong></span>
                        <span>📈 حجم: <strong>${signal.volumeRatio.toFixed(1)}x</strong></span>
                        <span>⚡ ATR: <strong>${signal.atr.toFixed(6)}</strong></span>
                        <span>⏰ ${new Date(signal.timestamp).toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = signalsHTML;
    }

    updateStats(signals) {
        const totalSignals = signals.length;
        const buySignals = signals.filter(s => s.signalType === 'BUY').length;
        const sellSignals = signals.filter(s => s.signalType === 'SELL').length;
        
        // تحديث العناصر في الهيدر
        const activeSignalsElement = document.getElementById('active-signals');
        const buySignalsElement = document.getElementById('buy-signals');
        const sellSignalsElement = document.getElementById('sell-signals');
        const lastUpdateElement = document.getElementById('last-update');
        
        if (activeSignalsElement) activeSignalsElement.textContent = totalSignals;
        if (buySignalsElement) buySignalsElement.textContent = buySignals;
        if (sellSignalsElement) sellSignalsElement.textContent = sellSignals;
        if (lastUpdateElement) {
            const now = new Date();
            lastUpdateElement.textContent = now.toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        console.log(`📊 الإحصائيات: ${totalSignals} إشارة (${buySignals} شراء، ${sellSignals} بيع)`);
    }

    startAutoScan() {
        console.log('🔄 بدء الفحص التلقائي...');
        
        // فحص فوري عند البدء
        setTimeout(() => {
            this.loadUTBotSignals();
        }, 2000);
        
        // فحص كل 15 دقيقة (900000 مللي ثانية) - زيادة الفترة لتجنب Rate Limit
        setInterval(() => {
            console.log('🔄 فحص تلقائي مجدول...');
            this.loadUTBotSignals();
        }, 900000);
        
        // إعداد زر الفحص اليدوي
        const manualScanBtn = document.getElementById('manual-scan-btn');
        if (manualScanBtn) {
            manualScanBtn.addEventListener('click', () => {
                if (!this.isScanning) {
                    console.log('👆 فحص يدوي بواسطة المستخدم');
                    this.loadUTBotSignals();
                }
            });
        }
    }
}

// إنشاء مثيل عام للاستخدام
const utbotScanner = new UTBotScanner();

// تصدير للاستخدام في ملفات أخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UTBotScanner;
}

