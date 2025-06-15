class UTBotScanner {
    constructor() {
        this.apiBase = 'https://www.okx.com/api/v5';
        this.symbols = [];
        this.isScanning = false;
        this.volumeCache = new Map();
        
        this.apiKey = 'b20c667d-ae40-48a6-93f4-a11a64185068';
        this.secretKey = 'BD7C76F71D1A4E01B4C7E1A23B620365';
        this.passphrase = '212160Nm$#';
        
        this.targetSettings = {
            baseATRMultiplier: 3.0,
            baseStopMultiplier: 1.4,
            atrPeriod: 14,
            volumePeriod: 20,
            minVolumeRatio: 0.8,
            minRiskReward: 1.8
        };
        
        // بدء التشغيل عند تحميل الصفحة
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('🚀 تهيئة UT Bot Scanner...');
        this.startAutoScan();
    }

    async fetchTopSymbols() {
        try {
            console.log('📊 جاري جلب قائمة العملات من OKX...');
            
            const response = await fetch(`${this.apiBase}/market/tickers?instType=SPOT`);
            const result = await response.json();
            
            if (result.code === '0') {
                this.symbols = result.data
                    .filter(ticker => 
                        ticker.instId.endsWith('-USDT') &&
                        parseFloat(ticker.vol24h) > 1000000
                    )
                    .sort((a, b) => parseFloat(b.vol24h) - parseFloat(a.vol24h))
                    .slice(0, 80)
                    .map(ticker => ticker.instId);
                
                console.log(`✅ تم تحميل ${this.symbols.length} عملة من OKX`);
                return this.symbols;
            } else {
                console.error('❌ خطأ من OKX API:', result.msg);
                return [];
            }
        } catch (error) {
            console.error('❌ خطأ في جلب العملات:', error);
            return [];
        }
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

    calculateHybridTargets(currentPrice, upperBand, lowerBand, atr, rsi, currentVolume, avgVolume, signalType) {
        let baseTargetMultiplier = this.targetSettings.baseATRMultiplier;
        let baseStopMultiplier = this.targetSettings.baseStopMultiplier;
        
        const bandDistance = Math.abs(upperBand - lowerBand);
        const signalStrength = signalType === 'BUY' 
            ? Math.abs(currentPrice - upperBand) / bandDistance
            : Math.abs(currentPrice - lowerBand) / bandDistance;

        if (signalStrength > 0.8) {
            baseTargetMultiplier *= 1.4;
            baseStopMultiplier *= 0.7;
            console.log(`🔥 إشارة قوية جداً: ${(signalStrength * 100).toFixed(1)}%`);
        } else if (signalStrength > 0.5) {
            baseTargetMultiplier *= 1.2;
            baseStopMultiplier *= 0.8;
            console.log(`💪 إشارة قوية: ${(signalStrength * 100).toFixed(1)}%`);
        } else if (signalStrength < 0.2) {
            baseTargetMultiplier *= 0.8;
            baseStopMultiplier *= 1.2;
            console.log(`⚠️ إشارة ضعيفة: ${(signalStrength * 100).toFixed(1)}%`);
        }

        if (rsi > 75) {
            baseTargetMultiplier *= 0.7;
            baseStopMultiplier *= 1.3;
            console.log(`📈 RSI مرتفع: ${rsi.toFixed(1)} - أهداف محافظة`);
        } else if (rsi < 25) {
            baseTargetMultiplier *= 0.7;
            baseStopMultiplier *= 1.3;
            console.log(`📉 RSI منخفض: ${rsi.toFixed(1)} - أهداف محافظة`);
        } else if (rsi > 45 && rsi < 55) {
            baseTargetMultiplier *= 1.1;
            console.log(`⚖️ RSI متوازن: ${rsi.toFixed(1)} - إشارة صحية`);
        }

        const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
        if (volumeRatio > 2.5) {
            baseTargetMultiplier *= 1.3;
            baseStopMultiplier *= 0.9;
            console.log(`🚀 حجم عالي جداً: ${volumeRatio.toFixed(1)}x - حركة قوية`);
        } else if (volumeRatio > 1.5) {
            baseTargetMultiplier *= 1.1;
            console.log(`📊 حجم جيد: ${volumeRatio.toFixed(1)}x`);
        } else if (volumeRatio < 1.0) {
            baseTargetMultiplier *= 0.7;
            baseStopMultiplier *= 1.2;
            console.log(`⚠️ حجم ضعيف: ${volumeRatio.toFixed(1)}x - تقليل المخاطرة`);
        } else if (volumeRatio < 0.5) {
            baseTargetMultiplier *= 0.6;
            baseStopMultiplier *= 1.3;
            console.log(`❌ حجم ضعيف جداً: ${volumeRatio.toFixed(1)}x - حذر شديد`);
        }

        let profitTarget, stopLoss;
        
        if (signalType === 'BUY') {
            profitTarget = currentPrice + (atr * baseTargetMultiplier);
            stopLoss = currentPrice - (atr * baseStopMultiplier);
            console.log(`🟢 BUY: سعر ${currentPrice.toFixed(2)} → هدف ${profitTarget.toFixed(2)} (صعود) | ستوب ${stopLoss.toFixed(2)} (نزول)`);
        } else if (signalType === 'SELL') {
            profitTarget = currentPrice - (atr * baseTargetMultiplier);
            stopLoss = currentPrice + (atr * baseStopMultiplier);
            console.log(`🔴 SELL: سعر ${currentPrice.toFixed(2)} → هدف ${profitTarget.toFixed(2)} (نزول) | ستوب ${stopLoss.toFixed(2)} (صعود)`);
        }

        const riskAmount = Math.abs(currentPrice - stopLoss);
        const rewardAmount = Math.abs(currentPrice - profitTarget);
        const riskReward = riskAmount > 0 ? rewardAmount / riskAmount : 0;

        if (signalType === 'BUY' && profitTarget <= currentPrice) {
            console.error(`❌ خطأ: هدف الشراء أقل من السعر الحالي!`);
        }
        if (signalType === 'SELL' && profitTarget >= currentPrice) {
            console.error(`❌ خطأ: هدف البيع أعلى من السعر الحالي!`);
        }

        console.log(`🎯 الأهداف المُصححة: ${signalType} | هدف ${this.formatPrice(profitTarget)} | ستوب ${this.formatPrice(stopLoss)} | نسبة ${riskReward.toFixed(2)}:1`);

        return {
            profitTarget: profitTarget,
            stopLoss: stopLoss,
            riskReward: riskReward,
            signalStrength: signalStrength,
            volumeRatio: volumeRatio,
            rsi: rsi
        };
    }

    formatPrice(price) {
        if (price < 0.000001) return price.toFixed(10);
        if (price < 0.001) return price.toFixed(8);
        if (price < 1) return price.toFixed(6);
        if (price < 100) return price.toFixed(4);
        return price.toFixed(2);
    }

    async checkUTBotSignal(symbol, timeframe) {
        try {
            const response = await fetch(`${this.apiBase}/market/candles?instId=${symbol}&bar=${timeframe}&limit=100`);
            const result = await response.json();
            
            if (result.code !== '0' || !result.data) return null;
            
            const klines = result.data;
            if (klines.length < 50) return null;

            const candles = klines.map(k => ({
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                hl2: (parseFloat(k[2]) + parseFloat(k[3])) / 2
            }));

            const atr = this.calculateATR(candles, this.targetSettings.atrPeriod);
            const rsi = this.calculateRSI(candles);
            const avgVolume = this.calculateAverageVolume(candles, this.targetSettings.volumePeriod);
            const currentVolume = candles[candles.length - 1].volume;
            
            const keyValue = 0.8;
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            const prev2 = candles[candles.length - 3];
            
            const upperBand = current.hl2 + (atr * keyValue);
            const lowerBand = current.hl2 - (atr * keyValue);
            
            const buyConditions = [
                current.close > upperBand && previous.close <= upperBand,
                current.close > upperBand * 0.98 && current.close > previous.close && previous.close > prev2.close,
                current.close > upperBand * 1.01
            ];
            
            const sellConditions = [
                current.close < lowerBand && previous.close >= lowerBand,
                current.close < lowerBand * 1.02 && current.close < previous.close && previous.close < prev2.close,
                current.close < lowerBand * 0.99
            ];
            
            const isBuySignal = buyConditions.some(condition => condition);
            const isSellSignal = sellConditions.some(condition => condition);
            
            if (isBuySignal || isSellSignal) {
                const signalType = isBuySignal ? 'BUY' : 'SELL';
                
                const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
                if (volumeRatio < 0.8) {
                    console.log(`⚠️ ${symbol}: حجم ضعيف ${volumeRatio.toFixed(1)}x - تم تجاهل الإشارة`);
                    return null;
                }

                const hybridTargets = this.calculateHybridTargets(
                    current.close, upperBand, lowerBand, atr, rsi, 
                    currentVolume, avgVolume, signalType
                );
                
                const baseStrength = signalType === 'BUY'
                    ? ((current.close - upperBand) / upperBand * 100)
                    : ((lowerBand - current.close) / lowerBand * 100);
                
                const timeframeBonus = timeframe === '1H' ? 15 : 10;
                const finalScore = Math.abs(baseStrength) + timeframeBonus + (hybridTargets.signalStrength * 20);

                if (hybridTargets.riskReward < 1.8) {
                    console.log(`⚠️ ${symbol}: نسبة مخاطرة ضعيفة ${hybridTargets.riskReward.toFixed(2)}:1 - تم تجاهل الإشارة`);
                    return null;
                }

                console.log(`${signalType === 'BUY' ? '🟢' : '🔴'} إشارة ${signalType === 'BUY' ? 'شراء' : 'بيع'} هجينة: ${symbol}`);
                
                return {
                    symbol: symbol,
                    price: this.formatPrice(current.close),
                    timeframe: timeframe,
                    strength: baseStrength,
                    score: finalScore,
                    change24h: await this.get24hChange(symbol),
                    signalType: signalType,
                    profitTarget: this.formatPrice(hybridTargets.profitTarget),
                    stopLoss: this.formatPrice(hybridTargets.stopLoss),
                    riskReward: hybridTargets.riskReward,
                    rsi: hybridTargets.rsi,
                    atr: atr,
                    volumeRatio: hybridTargets.volumeRatio,
                    signalStrength: hybridTargets.signalStrength,
                    upperBand: this.formatPrice(upperBand),
                    lowerBand: this.formatPrice(lowerBand),
                    timestamp: Date.now()
                };
            }
            
            return null;
        } catch (error) {
            console.error(`❌ خطأ في فحص ${symbol}:`, error);
            return null;
        }
    }

    async get24hChange(symbol) {
        try {
            const response = await fetch(`${this.apiBase}/market/ticker?instId=${symbol}`);
            const result = await response.json();
            
            if (result.code === '0' && result.data && result.data.length > 0) {
                return parseFloat(result.data[0].sodUtc8);
            }
            return 0;
        } catch (error) {
            console.error(`❌ خطأ في جلب التغيير اليومي لـ ${symbol}:`, error);
            return 0;
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
            
            if (this.symbols.length === 0) {
                await this.fetchTopSymbols();
            }

            const timeframes = ['1H', '4H'];
            const allSignals = [];
            
            for (const timeframe of timeframes) {
                console.log(`📊 فحص الإطار الزمني ${timeframe}...`);
                
                const promises = this.symbols.map(symbol => 
                    this.checkUTBotSignal(symbol, timeframe)
                );
                
                const results = await Promise.allSettled(promises);
                const signals = results
                    .filter(result => result.status === 'fulfilled' && result.value)
                    .map(result => result.value);
                
                allSignals.push(...signals);
                console.log(`✅ ${timeframe}: وُجد ${signals.length} إشارة`);
            }

            // ترتيب الإشارات حسب القوة والنقاط
            const sortedSignals = allSignals
                .sort((a, b) => b.score - a.score)
                .slice(0, 3); // أفضل 3 إشارات فقط

            console.log(`🎯 إجمالي الإشارات المختارة: ${sortedSignals.length}`);
            
            this.displaySignals(sortedSignals);
            this.updateStats(sortedSignals);
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الإشارات:', error);
            this.showError('حدث خطأ في تحميل الإشارات');
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

        // تحديث حالة الفحص
        const statusElement = document.querySelector('.scan-status span');
        if (statusElement) {
            statusElement.textContent = 'جاري الفحص...';
            statusElement.style.color = '#ff9800';
        }

        // تعطيل زر الفحص
        const scanBtn = document.getElementById('manual-scan-btn');
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الفحص...';
        }
    }

    hideLoading() {
        // تحديث حالة الفحص
        const statusElement = document.querySelector('.scan-status span');
        if (statusElement) {
            statusElement.textContent = 'نشط';
            statusElement.style.color = '#4CAF50';
        }

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
                    <small>سيتم البحث مرة أخرى خلال 12 دقيقة</small>
                </div>
            `;
            return;
        }

        const signalsHTML = signals.map(signal => {
            const isProfit = signal.change24h > 0;
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
                        <div class="timeframe-indicator">${signal.timeframe}</div>
                        <strong>${signal.symbol}</strong>
                        <span style="color: ${signalColor}; font-weight: bold;">
                            <i class="fas ${signalIcon}"></i> ${signal.signalType}
                        </span>
                        <span style="color: ${isProfit ? '#4CAF50' : '#f44336'}; font-weight: bold;">
                            ${signal.change24h > 0 ? '+' : ''}${signal.change24h.toFixed(2)}%
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
                        <span>🔥 قوة: <strong>${(signal.signalStrength * 100).toFixed(0)}%</strong></span>
                        <span>⚡ ATR: <strong>${signal.atr.toFixed(6)}</strong></span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = signalsHTML;
        
        // تحديث وقت آخر تحديث
        const lastUpdateElement = document.querySelector('.last-update');
        if (lastUpdateElement) {
            const now = new Date();
            lastUpdateElement.textContent = `آخر تحديث: ${now.toLocaleTimeString('ar-SA')}`;
        }
    }

    updateStats(signals) {
        // إحصائيات الإشارات
        const totalSignals = signals.length;
        const buySignals = signals.filter(s => s.signalType === 'BUY').length;
        const sellSignals = signals.filter(s => s.signalType === 'SELL').length;
        
        // تحديث العناصر في الهيدر
        const activeSignalsElement = document.querySelector('.stat-item:nth-child(1) .stat-value');
        const buySignalsElement = document.querySelector('.stat-item:nth-child(2) .stat-value');
        const sellSignalsElement = document.querySelector('.stat-item:nth-child(3) .stat-value');
        const lastUpdateElement = document.querySelector('.stat-item:nth-child(4) .stat-value');
        
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
        this.loadUTBotSignals();
        
        // فحص كل 12 دقيقة (720000 مللي ثانية)
        setInterval(() => {
            console.log('🔄 فحص تلقائي مجدول...');
            this.loadUTBotSignals();
        }, 720000);
        
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
