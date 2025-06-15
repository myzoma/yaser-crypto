// UT Bot Scanner - النظام الهجين الذكي المتطور
class UTBotScanner {
    constructor() {
        this.apiBase = 'https://www.okx.com/api/v5';
        this.symbols = [];
        this.isScanning = false;
        this.volumeCache = new Map();
        this.lastUpdateTime = null;
        
        // إعدادات النظام الهجين المتقدم
        this.targetSettings = {
            baseATRMultiplier: 3.0,
            baseStopMultiplier: 1.4,
            atrPeriod: 14,
            volumePeriod: 20,
            minVolumeRatio: 0.8,
            minRiskReward: 1.8,
            keyValue: 0.8,
            rsiPeriod: 14
        };
        
        console.log('🚀 UT Bot Scanner الهجين تم تهيئته بنجاح');
    }

    // جلب أفضل العملات من OKX
    async fetchTopSymbols() {
        try {
            console.log('📊 جاري جلب قائمة العملات من OKX...');
            
            const response = await fetch(`${this.apiBase}/market/tickers?instType=SPOT`);
            const result = await response.json();
            
            if (result.code === '0') {
                this.symbols = result.data
                    .filter(ticker => 
                        ticker.instId.endsWith('-USDT') &&
                        parseFloat(ticker.vol24h) > 1000000 &&
                        parseFloat(ticker.last) > 0
                    )
                    .sort((a, b) => parseFloat(b.vol24h) - parseFloat(a.vol24h))
                    .slice(0, 100)
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

    // حساب ATR (Average True Range) بدقة عالية
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

    // حساب RSI (Relative Strength Index)
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

    // حساب متوسط الحجم
    calculateAverageVolume(candles, period = 20) {
        if (candles.length < period) return 0;
        
        let volumeSum = 0;
        for (let i = candles.length - period; i < candles.length; i++) {
            volumeSum += candles[i].volume;
        }
        return volumeSum / period;
    }

    // النظام الهجين الذكي لحساب الأهداف
    calculateHybridTargets(currentPrice, upperBand, lowerBand, atr, rsi, currentVolume, avgVolume, signalType) {
        let baseTargetMultiplier = this.targetSettings.baseATRMultiplier;
        let baseStopMultiplier = this.targetSettings.baseStopMultiplier;
        
        // حساب قوة الإشارة
        const bandDistance = Math.abs(upperBand - lowerBand);
        const signalStrength = signalType === 'BUY' 
            ? Math.abs(currentPrice - upperBand) / bandDistance
            : Math.abs(currentPrice - lowerBand) / bandDistance;

        // تعديل المضاعفات حسب قوة الإشارة
        if (signalStrength > 0.8) {
            baseTargetMultiplier *= 1.4;
            baseStopMultiplier *= 0.7;
        } else if (signalStrength > 0.5) {
            baseTargetMultiplier *= 1.2;
            baseStopMultiplier *= 0.8;
        } else if (signalStrength < 0.2) {
            baseTargetMultiplier *= 0.8;
            baseStopMultiplier *= 1.2;
        }
        
        // تعديل حسب RSI
        if (rsi > 75 || rsi < 25) {
            baseTargetMultiplier *= 0.7;
            baseStopMultiplier *= 1.3;
        } else if (rsi > 45 && rsi < 55) {
            baseTargetMultiplier *= 1.1;
        }
        
        // تعديل حسب الحجم
        const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
        if (volumeRatio > 2.5) {
            baseTargetMultiplier *= 1.3;
            baseStopMultiplier *= 0.9;
        } else if (volumeRatio > 1.5) {
            baseTargetMultiplier *= 1.1;
        } else if (volumeRatio < 1.0) {
            baseTargetMultiplier *= 0.7;
            baseStopMultiplier *= 1.2;
        }
        
        // حساب الأهداف النهائية
        let profitTarget, stopLoss;
        
        if (signalType === 'BUY') {
            profitTarget = currentPrice + (atr * baseTargetMultiplier);
            stopLoss = currentPrice - (atr * baseStopMultiplier);
        } else {
            profitTarget = currentPrice - (atr * baseTargetMultiplier);
            stopLoss = currentPrice + (atr * baseStopMultiplier);
        }
        
        // حساب نسبة المخاطرة
        const riskAmount = Math.abs(currentPrice - stopLoss);
        const rewardAmount = Math.abs(currentPrice - profitTarget);
        const riskReward = riskAmount > 0 ? rewardAmount / riskAmount : 0;
        
        return {
            profitTarget: profitTarget,
            stopLoss: stopLoss,
            riskReward: riskReward,
            signalStrength: signalStrength,
            volumeRatio: volumeRatio,
            rsi: rsi,
            atrValue: atr
        };
    }

    // تنسيق الأسعار
    formatPrice(price) {
        if (price < 0.000001) return price.toFixed(10);
        if (price < 0.001) return price.toFixed(8);
        if (price < 1) return price.toFixed(6);
        if (price < 100) return price.toFixed(4);
        return price.toFixed(2);
    }

    // فحص إشارة UT Bot لعملة واحدة
    async checkUTBotSignal(symbol, timeframe) {
        try {
            const response = await fetch(`${this.apiBase}/market/candles?instId=${symbol}&bar=${timeframe}&limit=100`);
            const result = await response.json();
            
            if (result.code !== '0' || !result.data) return null;
            
            const klines = result.data;
            if (klines.length < 50) return null;

            // تحويل البيانات
            const candles = klines.map(k => ({
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                hl2: (parseFloat(k[2]) + parseFloat(k[3])) / 2
            }));

            // حساب المؤشرات
            const atr = this.calculateATR(candles, this.targetSettings.atrPeriod);
            const rsi = this.calculateRSI(candles, this.targetSettings.rsiPeriod);
            const avgVolume = this.calculateAverageVolume(candles, this.targetSettings.volumePeriod);
            const currentVolume = candles[candles.length - 1].volume;
            
            // حساب البولينجر باندز المعدلة
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            const prev2 = candles[candles.length - 3];
            
            const upperBand = current.hl2 + (atr * this.targetSettings.keyValue);
            const lowerBand = current.hl2 - (atr * this.targetSettings.keyValue);
            
            // شروط الشراء المتقدمة
            const buyConditions = [
                current.close > upperBand && previous.close <= upperBand,
                current.close > upperBand * 0.98 && current.close > previous.close && previous.close > prev2.close,
                current.close > upperBand * 1.01
            ];
            
            // شروط البيع المتقدمة
            const sellConditions = [
                current.close < lowerBand && previous.close >= lowerBand,
                current.close < lowerBand * 1.02 && current.close < previous.close && previous.close < prev2.close,
                current.close < lowerBand * 0.99
            ];
            
            const isBuySignal = buyConditions.some(condition => condition);
            const isSellSignal = sellConditions.some(condition => condition);
            
            if (isBuySignal || isSellSignal) {
                const signalType = isBuySignal ? 'BUY' : 'SELL';
                
                // فلتر الحجم
                const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
                if (volumeRatio < this.targetSettings.minVolumeRatio) {
                    return null;
                }
                
                // حساب الأهداف الهجينة
                const hybridTargets = this.calculateHybridTargets(
                    current.close, upperBand, lowerBand, atr, rsi, 
                    currentVolume, avgVolume, signalType
                );
                
                // فلتر نسبة المخاطرة
                if (hybridTargets.riskReward < this.targetSettings.minRiskReward) {
                    return null;
                }
                
                // حساب النتيجة النهائية
                const baseStrength = signalType === 'BUY'
                    ? ((current.close - upperBand) / upperBand * 100)
                    : ((lowerBand - current.close) / lowerBand * 100);
                
                const timeframeBonus = timeframe === '1H' ? 15 : 10;
                const finalScore = Math.abs(baseStrength) + timeframeBonus + (hybridTargets.signalStrength * 20);
                
                return {
                    symbol: symbol,
                    price: this.formatPrice(current.close),
                    timeframe: timeframe,
                    strength: baseStrength,
                    score: finalScore,
                    change24h: await this.get24hChange(symbol),
                    type: signalType,
                    targets: {
                        profitTarget: this.formatPrice(hybridTargets.profitTarget),
                        stopLoss: this.formatPrice(hybridTargets.stopLoss),
                        riskReward: hybridTargets.riskReward.toFixed(2),
                        atrValue: this.formatPrice(hybridTargets.atrValue),
                        rsi: hybridTargets.rsi.toFixed(1),
                        volumeRatio: hybridTargets.volumeRatio.toFixed(1),
                        signalStrength: (hybridTargets.signalStrength * 100).toFixed(1)
                    }
                };
            }
            
            return null;
        } catch (error) {
            console.error(`❌ خطأ في فحص ${symbol}:`, error);
            return null;
        }
    }
    
    // جلب التغيير اليومي
    async get24hChange(symbol) {
        try {
            const response = await fetch(`${this.apiBase}/market/ticker?instId=${symbol}`);
            const result = await response.json();
            
            if (result.code === '0' && result.data && result.data.length > 0) {
                const data = result.data[0];
                let change = parseFloat(data.changePercent);
                
                if (isNaN(change) || change === 0) {
                    const lastPrice = parseFloat(data.last);
                    const openPrice = parseFloat(data.open24h);
                    
                    if (openPrice && openPrice > 0) {
                        change = ((lastPrice - openPrice) / openPrice) * 100;
                    }
                }
                
                return isNaN(change) ? '0.00' : change.toFixed(2);
            }
            return '0.00';
        } catch (error) {
            return '0.00';
        }
    }

    // فحص السوق بالكامل
    async scanAllMarket() {
        if (this.isScanning) {
            console.log('⏳ الفحص الهجين جاري بالفعل...');
            return [];
        }
        
        this.isScanning = true;
        console.log('🔥 بدء الفحص الهجين الذكي للسوق...');
        
        try {
            // تحميل العملات إذا لم تكن محملة
            if (this.symbols.length === 0) {
                await this.fetchTopSymbols();
            }
            const allSignals = [];
            const timeframes = ['1H', '30m'];
            
            for (const timeframe of timeframes) {
                console.log(`📊 فحص هجين لفريم ${timeframe}...`);
                let signalsFound = 0;
                
                const batchSize = 6;
                for (let i = 0; i < this.symbols.length; i += batchSize) {
                    const batch = this.symbols.slice(i, i + batchSize);
                    
                    const promises = batch.map(async symbol => {
                        try {
                            return await this.checkUTBotSignal(symbol, timeframe);
                        } catch (error) {
                            return null;
                        }
                    });
                    
                    const results = await Promise.all(promises);
                    
                    results.forEach(result => {
                        if (result) {
                            allSignals.push(result);
                            signalsFound++;
                        }
                    });
                    
                    // تأخير بسيط لتجنب حدود API
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                console.log(`🎯 فريم ${timeframe}: ${signalsFound} إشارة هجينة`);
            }

            // فلترة الإشارات المكررة واختيار الأقوى
            const uniqueSignals = new Map();
            
            allSignals.forEach(signal => {
                const key = signal.symbol;
                if (!uniqueSignals.has(key) || uniqueSignals.get(key).score < signal.score) {
                    uniqueSignals.set(key, signal);
                }
            });

            // ترتيب حسب النتيجة المركبة وأخذ أفضل 8 (لملء الشبكة)
            const finalSignals = Array.from(uniqueSignals.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 8);

            const buyCount = finalSignals.filter(s => s.type === 'BUY').length;
            const sellCount = finalSignals.filter(s => s.type === 'SELL').length;

            console.log(`🎉 الفحص الهجين اكتمل: ${allSignals.length} إشارة تم تحليلها`);
            console.log(`🏆 أفضل 8 إشارات هجينة: ${buyCount} شراء، ${sellCount} بيع`);
            
            if (finalSignals.length > 0) {
                finalSignals.forEach(signal => {
                    console.log(`🎯 ${signal.symbol}: نسبة ${signal.targets.riskReward}:1 | RSI: ${signal.targets.rsi} | حجم: ${signal.targets.volumeRatio}x`);
                });
            }
            
            this.lastUpdateTime = new Date();
            return finalSignals;
            
        } catch (error) {
            console.error('❌ خطأ في الفحص الهجين:', error);
            return [];
        } finally {
            this.isScanning = false;
        }
    }

    // تحديث الإحصائيات
    updateStats(signals) {
        const buySignals = signals.filter(s => s.type === 'BUY').length;
        const sellSignals = signals.filter(s => s.type === 'SELL').length;
        
        // تحديث عناصر الإحصائيات
        const activeSignalsEl = document.getElementById('active-signals');
        const buySignalsEl = document.getElementById('buy-signals');
        const sellSignalsEl = document.getElementById('sell-signals');
        const lastUpdateEl = document.getElementById('last-update');
        
        if (activeSignalsEl) activeSignalsEl.textContent = signals.length;
        if (buySignalsEl) buySignalsEl.textContent = buySignals;
        if (sellSignalsEl) sellSignalsEl.textContent = sellSignals;
        if (lastUpdateEl) {
            const now = new Date();
            lastUpdateEl.textContent = now.toLocaleTimeString('ar-SA', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }

    // تحديث حالة الفحص
    updateScanStatus(status, isScanning = false) {
        const statusEl = document.querySelector('.scan-status span');
        const indicatorEl = document.querySelector('.status-indicator');
        
        if (statusEl) statusEl.textContent = status;
        if (indicatorEl) {
            indicatorEl.className = `fas fa-circle status-indicator ${isScanning ? 'scanning' : 'ready'}`;
        }
    }
}

// إنشاء مثيل من الماسح الضوئي
const utScanner = new UTBotScanner();

// تحديث دالة loadUTBotSignals لعرض البطاقات
async function loadUTBotSignals() {
    const container = document.getElementById('utBotSignals');
    
    if (!container) {
        console.error('❌ عنصر utBotSignals غير موجود في الصفحة');
        return;
    }
    
    try {
        // تحديث حالة الفحص
        utScanner.updateScanStatus('جاري الفحص الهجين...', true);
        container.innerHTML = '<div class="ut-bot-loading">🔥 جاري الفحص الهجين الذكي للسوق...</div>';
        
        const signals = await utScanner.scanAllMarket();
        
        // تحديث الإحصائيات
        utScanner.updateStats(signals);
        utScanner.updateScanStatus('نشط - جاهز للفحص', false);
        
        if (signals.length === 0) {
            container.innerHTML = '<div class="ut-bot-loading">لا توجد إشارات هجينة حالياً 📊</div>';
            return;
        }

        const cardsHTML = signals.map(signal => {
            const cardClass = signal.type === 'BUY' ? 'buy-card' : 'sell-card';
            const signalIcon = signal.type === 'BUY' ? '🟢' : '🔴';
            const signalText = signal.type === 'BUY' ? 'شراء' : 'بيع';
            const signalTypeClass = signal.type === 'BUY' ? 'buy' : 'sell';
            const changeClass = parseFloat(signal.change24h) >= 0 ? 'positive' : 'negative';
            
            return `
                <div class="ut-bot-card ${cardClass}">
                    <div class="card-header">
                        <div class="signal-type ${signalTypeClass}">
                            <span>${signalIcon}</span>
                            <span>${signalText}</span>
                        </div>
                        <div class="timeframe-badge">${signal.timeframe}</div>
                    </div>
                    
                    <div class="symbol-info">
                        <div class="symbol-name">${signal.symbol.replace('-USDT', '/USDT')}</div>
                        <div class="symbol-price">
                            $${signal.price}
                            <span class="price-change ${changeClass}">(${signal.change24h}%)</span>
                        </div>
                    </div>
                    
                    <div class="targets-section">
                        <div class="target-row">
                            <span class="target-label">🎯 الهدف:</span>
                            <span class="target-value profit">$${signal.targets.profitTarget}</span>
                        </div>
                        <div class="target-row">
                            <span class="target-label">🛑 الستوب:</span>
                            <span class="target-value stop">$${signal.targets.stopLoss}</span>
                        </div>
                        <div class="target-row">
                            <span class="target-label">📊 النسبة:</span>
                            <span class="target-value ratio">${signal.targets.riskReward}:1</span>
                        </div>
                    </div>
                    
                    <div class="indicators-section">
                        <div class="indicator-item">
                            <span class="indicator-label">RSI:</span>
                            <span class="indicator-value">${signal.targets.rsi}</span>
                        </div>
                        <div class="indicator-item">
                            <span class="indicator-label">الحجم:</span>
                            <span class="indicator-value">${signal.targets.volumeRatio}x</span>
                        </div>
                        <div class="indicator-item">
                            <span class="indicator-label">القوة:</span>
                            <span class="indicator-value">${signal.targets.signalStrength}%</span>
                        </div>
                        <div class="indicator-item">
                            <span class="indicator-label">ATR:</span>
                            <span class="indicator-value">${signal.targets.atrValue}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = cardsHTML;
        
        console.log(`🎉 تم عرض ${signals.length} إشارة هجينة ذكية في البطاقات`);
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإشارات الهجينة:', error);
        container.innerHTML = '<div class="ut-bot-loading">❌ خطأ في تحميل البيانات الهجينة</div>';
        utScanner.updateScanStatus('خطأ في الاتصال', false);
    }
}

// دوال إضافية للتحكم في الإعدادات
function updateHybridSettings(baseATR, baseStop, atrPeriod, volumePeriod, minRiskReward) {
    utScanner.targetSettings.baseATRMultiplier = baseATR || 3.0;
    utScanner.targetSettings.baseStopMultiplier = baseStop || 1.4;
    utScanner.targetSettings.atrPeriod = atrPeriod || 14;
    utScanner.targetSettings.volumePeriod = volumePeriod || 20;
    utScanner.targetSettings.minRiskReward = minRiskReward || 1.8;
    
    console.log('🔧 تم تحديث إعدادات النظام الهجين:', utScanner.targetSettings);
}

// دالة لاختبار إشارة واحدة
async function testHybridSignal(symbol, timeframe = '1H') {
    try {
        console.log(`🧪 اختبار الإشارة الهجينة لـ ${symbol}...`);
        const signal = await utScanner.checkUTBotSignal(symbol, timeframe);
        if (signal) {
            console.log('🎯 نتيجة الاختبار:', signal);
            return signal;
        } else {
            console.log('❌ لا توجد إشارة حالياً');
            return null;
        }
    } catch (error) {
        console.error(`❌ خطأ في اختبار ${symbol}:`, error);
        return null;
    }
}

// دالة الفحص اليدوي
async function manualScan() {
    console.log('🔍 بدء الفحص اليدوي...');
    await loadUTBotSignals();
}

// إعداد الأحداث عند تحميل الصفحة
function setupEventListeners() {
    // زر الفحص اليدوي
    const manualScanBtn = document.getElementById('manual-scan-btn');
    if (manualScanBtn) {
        manualScanBtn.addEventListener('click', manualScan);
    }
    
    console.log('🎮 تم إعداد أحداث التحكم');
}

// تهيئة النظام
function initializeSystem() {
    console.log('🚀 تهيئة UT Bot Scanner الهجين...');
    
    // إعداد الأحداث
    setupEventListeners();
    
    // تحديث حالة البداية
    utScanner.updateScanStatus('جاري التهيئة...', true);
    
    // بدء الفحص الأول
    setTimeout(() => {
        loadUTBotSignals();
    }, 1000);
    
    console.log('✅ النظام جاهز للعمل');
}

// بدء التشغيل
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSystem);
} else {
    initializeSystem();
}

// تحديث تلقائي كل 12 دقيقة
setInterval(loadUTBotSignals, 720000);

// رسائل النظام
console.log('🚀🔥 UT Bot Scanner الهجين الذكي - جاهز للعمل!');
console.log('🎯 الميزات الهجينة الجديدة:');
console.log('   ✅ حساب ATR علمي دقيق');
console.log('   ✅ تحليل قوة إشارة UT Bot');
console.log('   ✅ مؤشر RSI للتشبع');
console.log('   ✅ تحليل الحجم والسيولة');
console.log('   ✅ أهداف ديناميكية ذكية');
console.log('   ✅ نسب مخاطرة محسوبة بدقة');
console.log('   ✅ عرض بطاقات شبكية 4x2');
console.log('   ✅ تحديث إحصائيات مباشر');
console.log('   ✅ فحص يدوي وتلقائي');
console.log('🔧 للتحكم: updateHybridSettings(baseATR, baseStop, atrPeriod, volumePeriod, minRiskReward)');
console.log('🧪 للاختبار: testHybridSignal("BTC-USDT", "1H")');
console.log('🔍 للفحص اليدوي: manualScan()');

// تصدير الدوال للاستخدام العام
window.utScanner = utScanner;
window.loadUTBotSignals = loadUTBotSignals;
window.updateHybridSettings = updateHybridSettings;
window.testHybridSignal = testHybridSignal;
window.manualScan = manualScan;
