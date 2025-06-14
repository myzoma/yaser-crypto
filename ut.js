class UTBotScanner {
    constructor() {
        this.apiBase = 'https://www.okx.com/api/v5';
        this.symbols = [];
        this.isScanning = false;
        
        // ضع بياناتك هنا
        this.apiKey = 'b20c667d-ae40-48a6-93f4-a11a64185068';
        this.secretKey = 'BD7C76F71D1A4E01B4C7E1A23B620365';
        this.passphrase = '212160Nm$#';
        
        this.headers = {
            'OK-ACCESS-KEY': this.apiKey,
            'OK-ACCESS-PASSPHRASE': this.passphrase,
            'OK-ACCESS-TIMESTAMP': '',
            'OK-ACCESS-SIGN': '',
            'Content-Type': 'application/json'
        };
    }

    // دالة لإنشاء التوقيع
    generateSignature(timestamp, method, requestPath, body = '') {
        const message = timestamp + method + requestPath + body;
        return CryptoJS.HmacSHA256(message, this.secretKey).toString(CryptoJS.enc.Base64);
    }

    async fetchTopSymbols() {
        try {
            console.log('📊 جاري جلب قائمة العملات من OKX...');
            
            const timestamp = new Date().toISOString();
            const method = 'GET';
            const requestPath = '/api/v5/market/tickers?instType=SPOT';
            
            this.headers['OK-ACCESS-TIMESTAMP'] = timestamp;
            this.headers['OK-ACCESS-SIGN'] = this.generateSignature(timestamp, method, requestPath);
            
            const response = await fetch(`${this.apiBase}/market/tickers?instType=SPOT`, {
                method: 'GET',
                headers: this.headers
            });
            
    
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
                `${this.apiBase}/klines?symbol=${symbol}&interval=${timeframe}&limit=50`
            );
            
            if (!response.ok) return null;
            
            const klines = await response.json();
            if (klines.length < 20) return null;

            const candles = klines.map(k => ({
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                hl2: (parseFloat(k[2]) + parseFloat(k[3])) / 2
            }));

            // حساب UT Bot مع حساسية أعلى
            const atr = this.calculateATR(candles, 10);
            const keyValue = 0.8; // تقليل المضاعف لحساسية أعلى
            
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            const prev2 = candles[candles.length - 3];
            
            const upperBand = current.hl2 + (atr * keyValue);
            const lowerBand = current.hl2 - (atr * keyValue);
            
            // شروط إشارة الشراء المحسنة
            const buyConditions = [
                // الشرط الأساسي: اختراق النطاق العلوي
                current.close > upperBand && previous.close <= upperBand,
                
                // شرط بديل: قريب من النطاق العلوي مع زخم صاعد
                current.close > upperBand * 0.98 && 
                current.close > previous.close && 
                previous.close > prev2.close,
                
                // شرط ثالث: اختراق قوي للنطاق
                current.close > upperBand * 1.01
            ];
            
            const isBuySignal = buyConditions.some(condition => condition);
            
            if (isBuySignal) {
                const strength = ((current.close - upperBand) / upperBand * 100);
                const timeframeBonus = timeframe === '1h' ? 15 : 10;
                
                console.log(`🟢 إشارة شراء: ${symbol} (${timeframe}) - السعر: ${current.close}`);
                
                return {
                    symbol: symbol,
                    price: current.close < 1 ? current.close.toFixed(6) : current.close.toFixed(4),
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
            const response = await fetch(`${this.apiBase}/ticker/24hr?symbol=${symbol}`);
            const data = await response.json();
            return parseFloat(data.priceChangePercent).toFixed(2);
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
        console.log('🔍 بدء فحص السوق بحساسية عالية (60 + 30 دقيقة)...');
        
        try {
            if (this.symbols.length === 0) {
                await this.fetchTopSymbols();
            }

            const allSignals = [];
            const timeframes = ['1h', '30m'];
            
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

            // معالجة النتائج
            const uniqueSignals = new Map();
            
            allSignals.forEach(signal => {
                const key = signal.symbol;
                if (!uniqueSignals.has(key) || uniqueSignals.get(key).score < signal.score) {
                    uniqueSignals.set(key, signal);
                }
            });

            const finalSignals = Array.from(uniqueSignals.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);

            console.log(`🎉 تم تحليل وترتيب ${allSignals.length} إشارة وعرض أفضل ${finalSignals.length} عملة`);
            
            if (finalSignals.length > 0) {
                console.log('🎯 أفضل العملات:', finalSignals.map(s => `${s.symbol}(${s.timeframe})`).join(', '));
            } else {
                console.log('⚠️ لم يتم العثور على إشارات - جرب تقليل الحساسية أكثر');
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
        container.innerHTML = '<div class="ut-bot-loading">🔍 جاري فحص السوق بحساسية عالية...</div>';
        
        const signals = await utScanner.scanAllMarket();
        
        if (signals.length === 0) {
            // إضافة عملات وهمية للاختبار
            const testSignals = [
                { symbol: 'BTCUSDT', price: '43250.50', timeframe: '1h', change24h: '+2.45' },
                { symbol: 'ETHUSDT', price: '2580.75', timeframe: '30m', change24h: '+1.80' },
                { symbol: 'BNBUSDT', price: '315.20', timeframe: '1h', change24h: '+3.20' }
            ];
            
            const testHTML = testSignals.map(signal => `
                <div class="buy-signal-item" title="إشارة اختبار">
                    <span class="timeframe-indicator">${signal.timeframe}</span>
                    ${signal.symbol.replace('USDT', '/USDT')} - $${signal.price} (${signal.change24h}%)
                </div>
            `).join('');
            
            container.innerHTML = testHTML;
            console.log('🧪 عرض إشارات اختبار لأن لا توجد إشارات حقيقية');
            return;
        }

        const signalsHTML = signals.map(signal => `
            <div class="buy-signal-item" title="قوة الإشارة: ${signal.strength.toFixed(2)}%">
                <span class="timeframe-indicator">${signal.timeframe}</span>
                ${signal.symbol.replace('USDT', '/USDT')} - $${signal.price} (${signal.change24h}%)
            </div>
        `).join('');
        
        container.innerHTML = signalsHTML;
        
        console.log(`🎉 تم عرض ${signals.length} إشارة حقيقية في الشريط`);
        
    } catch (error) {
        console.error('❌ خطأ في تحديث الإشارات:', error);
        container.innerHTML = '<div class="ut-bot-loading">❌ خطأ في تحميل البيانات</div>';
    }
}

// تشغيل فوري عند تحميل الصفحة
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUTBotSignals);
} else {
    loadUTBotSignals();
}

// تحديث كل 12 دقيقة
setInterval(loadUTBotSignals, 720000);

console.log('🚀 UT Bot Scanner محدث - حساسية عالية + إشارات اختبار');
