class UTBotScanner {
    constructor() {
        this.apiBase = 'https://www.okx.com/api/v5';
        this.symbols = [];
        this.isScanning = false;
        
        // ضع بياناتك هنا
        this.apiKey = 'b20c667d-ae40-48a6-93f4-a11a64185068';
        this.secretKey = 'BD7C76F71D1A4E01B4C7E1A23B620365';
        this.passphrase = '212160Nm$#';
        
        // إعدادات الأهداف
        this.targetSettings = {
            profitMultiplier: 2.5,
            stopMultiplier: 1.5,
            atrPeriod: 10
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

    calculateATR(candles, period = 10) {
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

    calculateTargets(currentPrice, atr, signalType) {
        const targets = {};
        
        if (signalType === 'BUY') {
            targets.profitTarget = currentPrice + (atr * this.targetSettings.profitMultiplier);
            targets.stopLoss = currentPrice - (atr * this.targetSettings.stopMultiplier);
            targets.riskReward = this.targetSettings.profitMultiplier / this.targetSettings.stopMultiplier;
        } else if (signalType === 'SELL') {
            targets.profitTarget = currentPrice - (atr * this.targetSettings.profitMultiplier);
            targets.stopLoss = currentPrice + (atr * this.targetSettings.stopMultiplier);
            targets.riskReward = this.targetSettings.profitMultiplier / this.targetSettings.stopMultiplier;
        }
        
        return targets;
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
            const response = await fetch(
                `${this.apiBase}/market/candles?instId=${symbol}&bar=${timeframe}&limit=50`
            );
            
            const result = await response.json();
            if (result.code !== '0' || !result.data) return null;
            
            const klines = result.data;
            if (klines.length < 20) return null;

            const candles = klines.map(k => ({
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                hl2: (parseFloat(k[2]) + parseFloat(k[3])) / 2
            }));

            const atr = this.calculateATR(candles, this.targetSettings.atrPeriod);
            const keyValue = 0.8;
            
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            const prev2 = candles[candles.length - 3];
            
            const upperBand = current.hl2 + (atr * keyValue);
            const lowerBand = current.hl2 - (atr * keyValue);
            
            const buyConditions = [
                current.close > upperBand && previous.close <= upperBand,
                current.close > upperBand * 0.98 && 
                current.close > previous.close && 
                previous.close > prev2.close,
                current.close > upperBand * 1.01
            ];
            
            const sellConditions = [
                current.close < lowerBand && previous.close >= lowerBand,
                current.close < lowerBand * 1.02 && 
                current.close < previous.close && 
                previous.close < prev2.close,
                current.close < lowerBand * 0.99
            ];
            
            const isBuySignal = buyConditions.some(condition => condition);
            const isSellSignal = sellConditions.some(condition => condition);
            
            if (isBuySignal) {
                const strength = ((current.close - upperBand) / upperBand * 100);
                const timeframeBonus = timeframe === '1H' ? 15 : 10;
                const targets = this.calculateTargets(current.close, atr, 'BUY');
                
                console.log(`🟢 إشارة شراء: ${symbol} (${timeframe}) - السعر: ${current.close}`);
                console.log(`🎯 هدف الربح: ${this.formatPrice(targets.profitTarget)} | وقف الخسارة: ${this.formatPrice(targets.stopLoss)}`);
                
                return {
                    symbol: symbol,
                    price: this.formatPrice(current.close),
                    timeframe: timeframe,
                    strength: strength,
                    score: Math.abs(strength) + timeframeBonus,
                    change24h: await this.get24hChange(symbol),
                    type: 'BUY',
                    targets: {
                        profitTarget: this.formatPrice(targets.profitTarget),
                        stopLoss: this.formatPrice(targets.stopLoss),
                        riskReward: targets.riskReward.toFixed(2),
                        atrValue: this.formatPrice(atr)
                    }
                };
            }
            
            if (isSellSignal) {
                const strength = ((lowerBand - current.close) / lowerBand * 100);
                const timeframeBonus = timeframe === '1H' ? 15 : 10;
                const targets = this.calculateTargets(current.close, atr, 'SELL');
                
                console.log(`🔴 إشارة بيع: ${symbol} (${timeframe}) - السعر: ${current.close}`);
                console.log(`🎯 هدف الربح: ${this.formatPrice(targets.profitTarget)} | وقف الخسارة: ${this.formatPrice(targets.stopLoss)}`);
                
                return {
                    symbol: symbol,
                    price: this.formatPrice(current.close),
                    timeframe: timeframe,
                    strength: strength,
                    score: Math.abs(strength) + timeframeBonus,
                    change24h: await this.get24hChange(symbol),
                    type: 'SELL',
                    targets: {
                        profitTarget: this.formatPrice(targets.profitTarget),
                        stopLoss: this.formatPrice(targets.stopLoss),
                        riskReward: targets.riskReward.toFixed(2),
                        atrValue: this.formatPrice(atr)
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
                
                if (Math.abs(change) < 0.01 && Math.abs(change) > 0) {
                    change = change * 100;
                }
                
                return isNaN(change) ? '0.00' : change.toFixed(2);
            }
            return '0.00';
        } catch (error) {
            console.warn(`خطأ في جلب التغيير لـ ${symbol}:`, error);
            return '0.00';
        }
    }

    async scanAllMarket() {
        if (this.isScanning) {
            console.log('⏳ الفحص جاري بالفعل...');
            return [];
        }

        this.isScanning = true;
        console.log('🔍 بدء فحص السوق مع حساب الأهداف...');
        
        try {
            if (this.symbols.length === 0) {
                await this.fetchTopSymbols();
            }

            const allSignals = [];
            const timeframes = ['1H', '30m'];
            
            for (const timeframe of timeframes) {
                console.log(`📊 فحص فريم ${timeframe}...`);
                let signalsFound = 0;
                
                const batchSize = 8;
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
                    
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
                
                console.log(`📈 فريم ${timeframe}: ${signalsFound} إشارة`);
            }

            const uniqueSignals = new Map();
            
            allSignals.forEach(signal => {
                const key = signal.symbol;
                if (!uniqueSignals.has(key) || uniqueSignals.get(key).score < signal.score) {
                    uniqueSignals.set(key, signal);
                }
            });

            const finalSignals = Array.from(uniqueSignals.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            const buyCount = finalSignals.filter(s => s.type === 'BUY').length;
            const sellCount = finalSignals.filter(s => s.type === 'SELL').length;

            console.log(`🎉 تم تحليل ${allSignals.length} إشارة وعرض أفضل 3 عملات: ${buyCount} شراء، ${sellCount} بيع`);
            
            if (finalSignals.length > 0) {
                console.log('🎯 أفضل 3 عملات مع الأهداف:', 
                    finalSignals.map(s => 
                        `${s.symbol}(${s.timeframe}-${s.type}) Target: ${s.targets.profitTarget}`
                    ).join(', ')
                );
            }
            
            return finalSignals;
            
        } catch (error) {
            console.error('❌ خطأ عام في فحص السوق:', error);
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
        container.innerHTML = '<div class="ut-bot-loading">🔍 جاري فحص السوق وحساب الأهداف...</div>';
        
        const signals = await utScanner.scanAllMarket();
        
        if (signals.length === 0) {
            container.innerHTML = '<div class="ut-bot-loading">لا توجد إشارات حالياً 📊</div>';
            return;
        }

                const signalsHTML = signals.map(signal => {
            const signalColor = signal.type === 'BUY' ? '#4CAF50' : '#f44336';
            const signalIcon = signal.type === 'BUY' ? '🟢' : '🔴';
            const signalText = signal.type === 'BUY' ? 'شراء' : 'بيع';
            
            return `
                <div class="${signal.type.toLowerCase()}-signal-item" title="قوة الإشارة: ${signal.strength.toFixed(2)}%">
                    <div class="signal-header">
                        <span class="timeframe-indicator">${signal.timeframe}</span>
                        <span style="color: ${signalColor};">${signalIcon} ${signalText}</span>
                        <strong>${signal.symbol.replace('-USDT', '/USDT')}</strong>
                        <span style="color: ${signalColor}; font-weight: bold;">$${signal.price}</span>
                        <span style="color: ${parseFloat(signal.change24h) >= 0 ? '#4CAF50' : '#f44336'}; margin-left: 5px;">
                            (${signal.change24h}%)
                        </span>
                    </div>
                    <div class="targets-info" style="margin-top: 5px; font-size: 12px; color: #666;">
                        🎯 <span style="color: #4CAF50;">هدف: $${signal.targets.profitTarget}</span> | 
                        🛑 <span style="color: #f44336;">ستوب: $${signal.targets.stopLoss}</span> | 
                        📊 <span style="color: #2196F3;">نسبة: ${signal.targets.riskReward}:1</span>
                    </div>
                    <div class="atr-info" style="margin-top: 3px; font-size: 11px; color: #999;">
                        ATR: ${signal.targets.atrValue} | قوة: ${signal.strength.toFixed(1)}%
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = signalsHTML;
        
        console.log(`🎉 تم عرض ${signals.length} إشارة مع الأهداف في الشريط`);
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإشارات:', error);
        container.innerHTML = '<div class="ut-bot-loading">❌ خطأ في تحميل البيانات</div>';
    }
}

// دالة إضافية لتحديث إعدادات الأهداف
function updateTargetSettings(profitMultiplier, stopMultiplier, atrPeriod) {
    utScanner.targetSettings.profitMultiplier = profitMultiplier || 2.5;
    utScanner.targetSettings.stopMultiplier = stopMultiplier || 1.5;
    utScanner.targetSettings.atrPeriod = atrPeriod || 10;
    
    console.log('🔧 تم تحديث إعدادات الأهداف:', utScanner.targetSettings);
}

// دالة لحساب الأهداف لعملة محددة
async function calculateTargetsForSymbol(symbol, timeframe = '1H') {
    try {
        const signal = await utScanner.checkUTBotSignal(symbol, timeframe);
        if (signal && signal.targets) {
            console.log(`🎯 أهداف ${symbol}:`, signal.targets);
            return signal.targets;
        }
        return null;
    } catch (error) {
        console.error(`❌ خطأ في حساب أهداف ${symbol}:`, error);
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

console.log('🚀 UT Bot Scanner مع حساب الأهداف - جاهز للعمل!');
console.log('🎯 الميزات الجديدة:');
console.log('   ✅ حساب أهداف الربح تلقائياً');
console.log('   ✅ حساب وقف الخسارة تلقائياً');
console.log('   ✅ نسبة المخاطرة/العائد');
console.log('   ✅ قيمة ATR لكل إشارة');
console.log('🔧 لتغيير الإعدادات: updateTargetSettings(profitMultiplier, stopMultiplier, atrPeriod)');
