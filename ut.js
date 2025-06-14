class UTBotScanner {
    constructor() {
        this.apiBase = 'https://api.binance.com/api/v3';
        this.symbols = [];
        this.isScanning = false;
    }

    async fetchTopSymbols() {
        try {
            const response = await fetch(`${this.apiBase}/ticker/24hr`);
            const tickers = await response.json();
            
            this.symbols = tickers
                .filter(ticker => 
                    ticker.symbol.endsWith('USDT') && 
                    parseFloat(ticker.volume) > 500000 &&
                    !ticker.symbol.includes('UP') && 
                    !ticker.symbol.includes('DOWN') &&
                    !ticker.symbol.includes('BULL') &&
                    !ticker.symbol.includes('BEAR') &&
                    ticker.symbol !== 'USDCUSDT' &&
                    ticker.symbol !== 'BUSDUSDT'
                )
                .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
                .slice(0, 80)
                .map(ticker => ticker.symbol);
                
            console.log(`📊 تم تحميل ${this.symbols.length} عملة للفحص`);
            return this.symbols;
        } catch (error) {
            console.error('خطأ في جلب العملات:', error);
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

    async checkUTBotSignal(symbol) {
        try {
            const response = await fetch(
                `${this.apiBase}/klines?symbol=${symbol}&interval=15m&limit=50`
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
            const keyValue = 1.0; // المضاعف الافتراضي
            
            const current = candles[candles.length - 1];
            const previous = candles[candles.length - 2];
            
            const upperBand = current.hl2 + (atr * keyValue);
            const lowerBand = current.hl2 - (atr * keyValue);
            
            // إشارة الشراء: السعر يخترق النطاق العلوي
            if (current.close > upperBand && previous.close <= upperBand) {
                return {
                    symbol: symbol.replace('USDT', '/USDT'),
                    price: current.close.toFixed(6),
                    time: new Date().toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    strength: ((current.close - upperBand) / upperBand * 100).toFixed(2)
                };
            }
            
            return null;
        } catch (error) {
            console.warn(`تخطي ${symbol}:`, error.message);
            return null;
        }
    }

    async scanAllMarket() {
        if (this.isScanning) {
            console.log('⏳ الفحص جاري بالفعل...');
            return [];
        }

        this.isScanning = true;
        console.log('🔍 بدء فحص السوق للعثور على إشارات UT Bot...');
        
        try {
            // جلب العملات إذا لم تكن محملة
            if (this.symbols.length === 0) {
                await this.fetchTopSymbols();
            }

            const buySignals = [];
            const batchSize = 8; // تقليل حجم الدفعة لتجنب القيود
            
            for (let i = 0; i < this.symbols.length; i += batchSize) {
                const batch = this.symbols.slice(i, i + batchSize);
                
                const promises = batch.map(symbol => 
                    this.checkUTBotSignal(symbol).catch(err => {
                        console.warn(`خطأ في ${symbol}:`, err.message);
                        return null;
                    })
                );
                
                const results = await Promise.all(promises);
                
                results.forEach(result => {
                    if (result) {
                        buySignals.push(result);
                    }
                });
                
                // توقف قصير بين الدفعات لتجنب تحديد المعدل
                if (i + batchSize < this.symbols.length) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            }

            console.log(`✅ تم العثور على ${buySignals.length} إشارة شراء من أصل ${this.symbols.length} عملة`);
            return buySignals;
            
        } catch (error) {
            console.error('خطأ في فحص السوق:', error);
            return [];
        } finally {
            this.isScanning = false;
        }
    }
}

// إنشاء مثيل من الماسح
const utScanner = new UTBotScanner();

// دالة تحديث الإشارات
async function loadUTBotSignals() {
    const container = document.getElementById('utBotSignals');
    
    if (!container) {
        console.error('عنصر utBotSignals غير موجود');
        return;
    }
    
    try {
        // عرض حالة التحميل
        container.innerHTML = '<div class="ut-bot-loading">🔍 جاري فحص السوق...</div>';
        
        const signals = await utScanner.scanAllMarket();
        
        if (signals.length === 0) {
            container.innerHTML = '<div class="ut-bot-loading">لا توجد إشارات شراء حالياً 📊</div>';
            return;
        }

        // ترتيب الإشارات حسب القوة
        signals.sort((a, b) => parseFloat(b.strength) - parseFloat(a.strength));

        const signalsHTML = signals.map(signal => `
            <div class="buy-signal-item" title="قوة الإشارة: ${signal.strength}%">
                ${signal.symbol} - $${signal.price} - ${signal.time}
            </div>
        `).join('');
        
        container.innerHTML = signalsHTML;
        
        // إضافة إحصائية في الكونسول
        console.log(`📈 تم عرض ${signals.length} إشارة شراء`);
        
    } catch (error) {
        console.error('خطأ في تحديث الإشارات:', error);
        container.innerHTML = '<div class="ut-bot-loading">❌ خطأ في تحميل البيانات</div>';
    }
}

// تشغيل الفحص عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 تم تحميل UT Bot Scanner');
    loadUTBotSignals();
});

// تحديث كل 10 دقائق
setInterval(loadUTBotSignals, 600000);

// تحديث عند العودة للصفحة
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        setTimeout(loadUTBotSignals, 2000);
    }
});
