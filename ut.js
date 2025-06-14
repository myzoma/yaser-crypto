class UTBotScanner {
    constructor() {
        this.apiBase = 'https://api.binance.com/api/v3';
        this.symbols = [];
        this.isScanning = false;
    }

    async fetchTopSymbols() {
        try {
            console.log('📊 جاري جلب قائمة العملات...');
            const response = await fetch(`${this.apiBase}/ticker/24hr`);
            const tickers = await response.json();
            
            this.symbols = tickers
                .filter(ticker => 
                    ticker.symbol.endsWith('USDT') && 
                    parseFloat(ticker.volume) > 2000000 &&
                    parseFloat(ticker.priceChangePercent) !== 0 &&
                    !ticker.symbol.includes('UP') && 
                    !ticker.symbol.includes('DOWN') &&
                    !ticker.symbol.includes('BULL') &&
                    !ticker.symbol.includes('BEAR') &&
                    ticker.symbol !== 'USDCUSDT' &&
                    ticker.symbol !== 'BUSDUSDT' &&
                    ticker.symbol !== 'TUSDUSDT'
                )
                .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
                .slice(0, 100)
                .map(ticker => ticker.symbol);
                
            console.log(`✅ تم تحميل ${this.symbols.length} عملة للفحص`);
            return this.symbols;
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

            // حساب UT Bot بالإعدادات الأصلية
            const atr = this.calculateATR(candles, 10);
            const keyValue = 1.0;
            
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            
            const upperBand = current.hl2 + (atr * keyValue);
            
            // إشارة شراء: اختراق النطاق العلوي
            if (current.close > upperBand && previous.close <= upperBand) {
                const strength = ((current.close - upperBand) / upperBand * 100);
                return {
                    symbol: symbol,
                    price: current.close < 1 ? current.close.toFixed(6) : current.close.toFixed(4),
                    timeframe: timeframe,
                    strength: strength,
                    score: strength + (timeframe === '1h' ? 10 : 5) // أولوية للفريم الأكبر
                };
            }
            
            return null;
        } catch (error) {
            return null;
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
            const timeframes = ['1h', '30m']; // 60 دقيقة + 30 دقيقة
            
            for (const timeframe of timeframes) {
                console.log(`📊 فحص فريم ${timeframe}...`);
                
                const batchSize = 10;
                for (let i = 0; i < this.symbols.length; i += batchSize) {
                    const batch = this.symbols.slice(i, i + batchSize);
                    
                    const promises = batch.map(symbol => 
                        this.checkUTBotSignal(symbol, timeframe).catch(() => null)
                    );
                    
                    const results = await Promise.all(promises);
                    
                    results.forEach(result => {
                        if (result) {
                            allSignals.push(result);
                        }
                    });
                    
                    // توقف بين الدفعات
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            // إزالة التكرارات وترتيب حسب القوة
            const uniqueSignals = [];
            const seenSymbols = new Set();
            
            allSignals
                .sort((a, b) => b.score - a.score)
                .forEach(signal => {
                    if (!seenSymbols.has(signal.symbol)) {
                        seenSymbols.add(signal.symbol);
                        uniqueSignals.push(signal);
                    }
                });

            // أخذ أفضل 10 عملات فقط
            const top10Signals = uniqueSignals.slice(0, 10);

            console.log(`✅ تم اختيار أفضل ${top10Signals.length} عملة من أصل ${allSignals.length} إشارة`);
            
            if (top10Signals.length > 0) {
                console.log('🎯 أفضل 10 عملات:', top10Signals.map(s => `${s.symbol}(${s.timeframe})`).join(', '));
            }
            
            return top10Signals;
            
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
        container.innerHTML = '<div class="ut-bot-loading">🔍 جاري فحص السوق (60 + 30 دقيقة)...</div>';
        
        const signals = await utScanner.scanAllMarket();
        
        if (signals.length === 0) {
            container.innerHTML = '<div class="ut-bot-loading">لا توجد إشارات شراء حالياً 📊</div>';
            return;
        }

        const signalsHTML = signals.map(signal => `
            <div class="buy-signal-item" title="قوة الإشارة: ${signal.strength.toFixed(2)}%">
                <span class="timeframe-indicator">${signal.timeframe}</span>
                ${signal.symbol.replace('USDT', '/USDT')} - $${signal.price}
            </div>
        `).join('');
        
        container.innerHTML = signalsHTML;
        
        console.log(`🎉 تم عرض أفضل ${signals.length} عملة في الشريط`);
        
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

// تحديث كل 15 دقيقة (مناسب للفريمات الكبيرة)
setInterval(loadUTBotSignals, 900000);

console.log('🚀 UT Bot Scanner تم تحميله - فريم 60 + 30 دقيقة - أفضل 10 عملات');
