class UTBotScanner {
    constructor() {
        this.apiBase = 'https://www.okx.com/api/v5';
        this.symbols = [];
        this.isScanning = false;
        this.volumeCache = new Map(); // لحفظ متوسط الحجم
        
        this.apiKey = 'b20c667d-ae40-48a6-93f4-a11a64185068';
        this.secretKey = 'BD7C76F71D1A4E01B4C7E1A23B620365';
        this.passphrase = '212160Nm$#';
        
      this.targetSettings = {
    baseATRMultiplier: 1.0,      // زيادة للنسب الأفضل
    baseStopMultiplier: 1.4,     // تحسين النسبة
    atrPeriod: 14,
    volumePeriod: 20,
    minVolumeRatio: 0.8,         // 🔥 فلتر حجم جديد
    minRiskReward: 1.8           // 🔥 فلتر نسبة جديد
};

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

    // 🔥 الطريقة الهجينة الذكية لحساب الأهداف
   calculateHybridTargets(currentPrice, upperBand, lowerBand, atr, rsi, currentVolume, avgVolume, signalType) {
    // 1️⃣ الأساس: ATR (علمي ودقيق)
    let baseTargetMultiplier = this.targetSettings.baseATRMultiplier;
    let baseStopMultiplier = this.targetSettings.baseStopMultiplier;
    
    // 2️⃣ تعديل حسب قوة إشارة UT Bot
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
    
    // 3️⃣ تعديل حسب RSI
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
    
    // 4️⃣ تعديل حسب الحجم
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

    
    // 5️⃣ حساب الأهداف النهائية - مُصحح! 🔧
    let profitTarget, stopLoss;
    
    if (signalType === 'BUY') {
        profitTarget = currentPrice + (atr * baseTargetMultiplier);
        stopLoss = currentPrice - (atr * baseStopMultiplier);
        console.log(`🟢 BUY: سعر ${currentPrice.toFixed(2)} → هدف ${profitTarget.toFixed(2)} (صعود) | ستوب ${stopLoss.toFixed(2)} (نزول)`);
    } else if (signalType === 'SELL') {
        profitTarget = currentPrice - (atr * baseTargetMultiplier);  // هدف البيع = نزول ✅
        stopLoss = currentPrice + (atr * baseStopMultiplier);        // ستوب البيع = صعود ✅
        console.log(`🔴 SELL: سعر ${currentPrice.toFixed(2)} → هدف ${profitTarget.toFixed(2)} (نزول) | ستوب ${stopLoss.toFixed(2)} (صعود)`);
    }
    
    // 6️⃣ حساب نسبة المخاطرة/العائد - مُصحح!
    const riskAmount = Math.abs(currentPrice - stopLoss);
    const rewardAmount = Math.abs(currentPrice - profitTarget);  // تغيير هنا!
    const riskReward = riskAmount > 0 ? rewardAmount / riskAmount : 0;
    
    // 7️⃣ تأكيد منطقية الأهداف
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
        if (price < 0.000001) return price.toFixed(10);        if (price < 0.001) return price.toFixed(8);
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
            
            const keyValue = 1;
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
    
    // 🔥 فلتر الحجم القوي - جديد
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
    if (volumeRatio < 0.8) {
        console.log(`⚠️ ${symbol}: حجم ضعيف ${volumeRatio.toFixed(1)}x - تم تجاهل الإشارة`);
        return null;
    }
    
    // 🔥 استخدام الطريقة الهجينة الذكية
    const hybridTargets = this.calculateHybridTargets(
                    current.close, upperBand, lowerBand, atr, rsi, 
                    currentVolume, avgVolume, signalType
                );
                
                const baseStrength = signalType === 'BUY' 
                    ? ((current.close - upperBand) / upperBand * 100)
                    : ((lowerBand - current.close) / lowerBand * 100);
                
                const timeframeBonus = timeframe === '1H' ? 15 : 10;
                const finalScore = Math.abs(baseStrength) + timeframeBonus + (hybridTargets.signalStrength * 20);
               
// 🎯 فلتر جودة إضافي
if (hybridTargets.riskReward < 1.8) {
    console.log(`⚠️ ${symbol}: نسبة مخاطرة ضعيفة ${hybridTargets.riskReward.toFixed(2)}:1 - تم تجاهل الإشارة`);
    return null;
}

console.log(`${signalType === 'BUY' ? '🟢' : '🔴'} إشارة`);

                console.log(`${signalType === 'BUY' ? '🟢' : '🔴'} إشارة ${signalType === 'BUY' ? 'شراء' : 'بيع'} هجينة: ${symbol}`);
                
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
                        atrValue: this.formatPrice(atr),
                        rsi: hybridTargets.rsi.toFixed(1),
                        volumeRatio: hybridTargets.volumeRatio.toFixed(1),
                        signalStrength: (hybridTargets.signalStrength * 100).toFixed(1)
                    }
                };
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

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

    async scanAllMarket() {
        if (this.isScanning) {
            console.log('⏳ الفحص الهجين جاري بالفعل...');
            return [];
        }

        this.isScanning = true;
        console.log('🔥 بدء الفحص الهجين الذكي للسوق...');
        
        try {
            if (this.symbols.length === 0) {
                await this.fetchTopSymbols();
            }

            const allSignals = [];
            const timeframes = ['1H', '30m'];
            
            for (const timeframe of timeframes) {
                console.log(`📊 فحص هجين لفريم ${timeframe}...`);
                let signalsFound = 0;
                
                const batchSize = 6; // تقليل الحمل للحسابات المعقدة
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
                    
                    await new Promise(resolve => setTimeout(resolve, 200)); // راحة أكثر
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

            // ترتيب حسب النتيجة المركبة وأخذ أفضل 3
            const finalSignals = Array.from(uniqueSignals.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            const buyCount = finalSignals.filter(s => s.type === 'BUY').length;
            const sellCount = finalSignals.filter(s => s.type === 'SELL').length;

            console.log(`🎉 الفحص الهجين اكتمل: ${allSignals.length} إشارة تم تحليلها`);
            console.log(`🏆 أفضل 3 إشارات هجينة: ${buyCount} شراء، ${sellCount} بيع`);
            
            if (finalSignals.length > 0) {
                finalSignals.forEach(signal => {
                    console.log(`🎯 ${signal.symbol}: نسبة ${signal.targets.riskReward}:1 | RSI: ${signal.targets.rsi} | حجم: ${signal.targets.volumeRatio}x`);
                });
            }
            
            return finalSignals;
            
        } catch (error) {
            console.error('❌ خطأ في الفحص الهجين:', error);
            return [];
        } finally {
            this.isScanning = false;
        }
    }
}

const utScanner = new UTBotScanner();

async function loadUTBotSignals() {
    const container = document.getElementById('utBotSignals');
    
    if (!container) {
        console.error('❌ عنصر utBotSignals غير موجود في الصفحة');
        return;
    }
    
    try {
        container.innerHTML = '<div class="ut-bot-loading">🔥 جاري الفحص الهجين الذكي للسوق...</div>';
        
        const signals = await utScanner.scanAllMarket();
        
        if (signals.length === 0) {
            container.innerHTML = '<div class="ut-bot-loading">لا توجد إشارات هجينة حالياً 📊</div>';
            return;
        }

        const signalsHTML = signals.map(signal => {
            const signalColor = signal.type === 'BUY' ? '#4CAF50' : '#f44336';
            const signalIcon = signal.type === 'BUY' ? '🟢' : '🔴';
            const signalText = signal.type === 'BUY' ? 'شراء' : 'بيع';
            
            // تحديد لون نسبة المخاطرة
            const riskRewardColor = parseFloat(signal.targets.riskReward) >= 2.0 ? '#4CAF50' : 
                                   parseFloat(signal.targets.riskReward) >= 1.5 ? '#FF9800' : '#f44336';
            
            return `
                <div class="${signal.type.toLowerCase()}-signal-item" style="border-left: 3px solid ${signalColor};">
                    <div class="signal-header">
                        <span class="timeframe-indicator">${signal.timeframe}</span>
                        <span style="color: ${signalColor};">${signalIcon} ${signalText}</span>
                        <strong>${signal.symbol.replace('-USDT', '/USDT')}</strong>
                        <span style="color: ${signalColor}; font-weight: bold;">$${signal.price}</span>
                        <span style="color: ${parseFloat(signal.change24h) >= 0 ? '#4CAF50' : '#f44336'};">
                            (${signal.change24h}%)
                        </span>
                    </div>
                    <div class="targets-info" style="margin-top: 5px; font-size: 12px; color: #666;">
                        🎯 <span style="color: #4CAF50;">هدف: $${signal.targets.profitTarget}</span> | 
                        🛑 <span style="color: #f44336;">ستوب: $${signal.targets.stopLoss}</span> | 
                        📊 <span style="color: ${riskRewardColor}; font-weight: bold;">نسبة: ${signal.targets.riskReward}:1</span>
                    </div>
                    <div class="hybrid-info" style="margin-top: 3px; font-size: 11px; color: #999;">
                        📈 RSI: ${signal.targets.rsi} | 📊 حجم: ${signal.targets.volumeRatio}x | 
                        💪 قوة: ${signal.targets.signalStrength}% | ATR: ${signal.targets.atrValue}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = signalsHTML;
        
        console.log(`🎉 تم عرض ${signals.length} إشارة هجينة ذكية في الشريط`);
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإشارات الهجينة:', error);
        container.innerHTML = '<div class="ut-bot-loading">❌ خطأ في تحميل البيانات الهجينة</div>';
    }
}

// دوال إضافية للتحكم في الإعدادات
function updateHybridSettings(baseATR, baseStop, atrPeriod, volumePeriod) {
    utScanner.targetSettings.baseATRMultiplier = baseATR || 2.5;
    utScanner.targetSettings.baseStopMultiplier = baseStop || 1.5;
    utScanner.targetSettings.atrPeriod = atrPeriod || 14;
    utScanner.targetSettings.volumePeriod = volumePeriod || 20;
    
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

// بدء التشغيل
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUTBotSignals);
} else {
    loadUTBotSignals();
}

// تحديث كل 12 دقيقة
setInterval(loadUTBotSignals, 720000);

console.log('🚀🔥 UT Bot Scanner الهجين الذكي - جاهز للعمل!');
console.log('🎯 الميزات الهجينة الجديدة:');
console.log('   ✅ حساب ATR علمي دقيق');
console.log('   ✅ تحليل قوة إشارة UT Bot');
console.log('   ✅ مؤشر RSI للتشبع');
console.log('   ✅ تحليل الحجم والسيولة');
console.log('   ✅ أهداف ديناميكية ذكية');
console.log('   ✅ نسب مخاطرة محسوبة بدقة');
console.log('🔧 للتحكم: updateHybridSettings(baseATR, baseStop, atrPeriod, volumePeriod)');
console.log('🧪 للاختبار: testHybridSignal("BTC-USDT", "1H")');
