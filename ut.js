class UTBotScanner {
    constructor() {
        this.apiBase = 'https://www.okx.com/api/v5';
        this.symbols = [];
        this.isScanning = false;
        
        // ضع بياناتك هنا
        this.apiKey = 'b20c667d-ae40-48a6-93f4-a11a64185068';
        this.secretKey = 'BD7C76F71D1A4E01B4C7E1A23B620365';
        this.passphrase = '212160Nm$#';
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

            const atr = this.calculateATR(candles, 10);
            const keyValue = 0.8;
            
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            const prev2 = candles[candles.length - 3];
            
            const upperBand = current.hl2 + (atr * keyValue);
            
            const buyConditions = [
                current.close > upperBand && previous.close <= upperBand,
                current.close > upperBand * 0.98 && 
                current.close > previous.close && 
                previous.close > prev2.close,
                current.close > upperBand * 1.01
            ];
            
            const isBuySignal = buyConditions.some(condition => condition);
            
            if (isBuySignal) {
                const strength = ((current.close - upperBand) / upperBand * 100);
                const timeframeBonus = timeframe === '1H' ? 15 : 10;
                
                console.log(`🟢 إشارة شراء: ${symbol} (${timeframe}) - السعر: ${current.close}`);
                
                return {
                    symbol: symbol,
                   price: current.close < 0.000001 ? current.close.toFixed(10) : 
       current.close < 1 ? current.close.toFixed(8) : current.close.toFixed(4),
                    timeframe: timeframe,
                    strength: strength,
                    score: Math.abs(strength) + timeframeBonus,
                    change24h: await this.get24hChange(symbol)
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
            const change = parseFloat(result.data[0].changePercent);
            return isNaN(change) ? '0.00' : change.toFixed(2);
        }
        return '0.00';
    } catch {
        return '0.00';
    }
}


    async scanAllMarket() {
        if (this.isScanning) {
            console.log('⏳ الفحص جاري بالفعل...');
            return [];
        }

        this.isScanning = true;
        console.log('🔍 بدء فحص السوق (60 + 30 دقيقة)...');
        
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

            console.log(`🎉 تم تحليل وترتيب ${allSignals.length} إشارة وعرض أفضل ${finalSignals.length} عملة`);
            
            if (finalSignals.length > 0) {
                console.log('🎯 أفضل العملات:', finalSignals.map(s => `${s.symbol}(${s.timeframe})`).join(', '));
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
        container.innerHTML = '<div class="ut-bot-loading">🔍 جاري فحص السوق...</div>';
        
        const signals = await utScanner.scanAllMarket();
        
        if (signals.length === 0) {
            container.innerHTML = '<div class="ut-bot-loading">لا توجد إشارات شراء حالياً 📊</div>';
            return;
        }

        const signalsHTML = signals.map(signal => `
    <div class="buy-signal-item" title="قوة الإشارة: ${signal.strength.toFixed(2)}%">
        <span class="timeframe-indicator">${signal.timeframe}</span>
        <strong>${signal.symbol.replace('-USDT', '/USDT')}</strong> - 
        <span style="color: #4CAF50; font-weight: bold;">$${signal.price}</span>
        <span style="color: ${parseFloat(signal.change24h) >= 0 ? '#4CAF50' : '#f44336'}; margin-left: 5px;">
            (${signal.change24h}%)
        </span>
    </div>
`).join('');

        
        container.innerHTML = signalsHTML;
        
        console.log(`🎉 تم عرض ${signals.length} إشارة في الشريط`);
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإشارات:', error);
        container.innerHTML = '<div class="ut-bot-loading">❌ خطأ في تحميل البيانات</div>';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUTBotSignals);
} else {
    loadUTBotSignals();
}

setInterval(loadUTBotSignals, 720000);

console.log('🚀 UT Bot Scanner - OKX API');
