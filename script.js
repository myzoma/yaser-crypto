class YaserCrypto {
    constructor() {
        this.coins = [];
        this.config = {
            okxApiUrl: "https://www.okx.com/api/v5",
            binanceApiUrl: "https://api1.binance.com/api/v3",
            requestDelay: 0, // تسريع التحميل
            maxCoins: 12,    // عدد العملات النهائية للعرض والتحليل
            minChange: 1,
            maxChange: 15,
            minVolume: 100000,
            dataSources: ['okx', 'binance']
        };
        this.requestDelay = 0; // تسريع التحميل
        this.init();
    }

    async init() {
        this.showLoading();
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
    }

    showLoading() {
        document.getElementById('coinsGrid').innerHTML = '<div class="loading">يتم التحليل الان .. انتظر قليلا من فضلك ؟...</div>';
    }

    showError(message) {
        document.getElementById('coinsGrid').innerHTML = `<div class="error">${message}</div>`;
    }

    async fetchData() {
        try {
            console.log('🚀 بدء عملية جلب البيانات من مصادر متعددة...');
            
            // جلب البيانات من كلا المصدرين بشكل متوازي
            const [okxSymbols, binanceSymbols] = await Promise.allSettled([
                this.fetchTopGainersFromOKX(),
                this.fetchTopGainersFromBinance()
            ]);

            let candidateSymbols = [];
            
            // دمج النتائج من OKX
            if (okxSymbols.status === 'fulfilled' && okxSymbols.value) {
                console.log(`📊 OKX: ${okxSymbols.value.length} عملة`);
                candidateSymbols = candidateSymbols.concat(
                    okxSymbols.value.map(symbol => ({ symbol, source: 'okx' }))
                );
            } else {
                console.warn('⚠️ فشل في جلب البيانات من OKX:', okxSymbols.reason);
            }

            // دمج النتائج من Binance
            if (binanceSymbols.status === 'fulfilled' && binanceSymbols.value) {
                console.log(`📊 Binance: ${binanceSymbols.value.length} عملة`);
                candidateSymbols = candidateSymbols.concat(
                    binanceSymbols.value.map(symbol => ({ symbol, source: 'binance' }))
                );
            } else {
                console.warn('⚠️ فشل في جلب البيانات من Binance:', binanceSymbols.reason);
            }

            if (candidateSymbols.length === 0) {
                throw new Error('لم يتم العثور على عملات مرشحة من أي مصدر');
            }

            // إزالة التكرارات وإعطاء أولوية للعملات الموجودة في كلا المصدرين
            const uniqueSymbols = this.mergeDuplicateSymbols(candidateSymbols);
            console.log(`📋 سيتم تحليل ${uniqueSymbols.length} عملة فريدة`);

            const results = [];
            for (let i = 0; i < uniqueSymbols.length; i++) {
                const { symbol, source, priority } = uniqueSymbols[i];
                
                try {
                    console.log(`🔄 تحليل ${symbol} من ${source}... (${i + 1}/${uniqueSymbols.length})`);
                    
                    const coin = await this.fetchCoinData(symbol, source);
                    if (coin && typeof coin.change24h === 'number' && !isNaN(coin.change24h)) {
                        coin.priority = priority;
                        coin.dataSource = source;
                        results.push(coin);
                        console.log(`✅ ${symbol}: ${coin.change24h.toFixed(2)}% (${source})`);
                    } else {
                        console.warn(`⚠️ بيانات غير صالحة لـ ${symbol}`);
                    }

                    if (i < uniqueSymbols.length - 1) {
                        await this.delay(this.requestDelay);
                    }

                } catch (error) {
                    console.warn(`❌ فشل في تحليل ${symbol}:`, error.message);
                    continue;
                }
            }

            if (results.length === 0) {
                throw new Error('فشل في الحصول على بيانات صالحة لأي عملة');
            }

            // 1- تحليل كل العملات المرشحة
            this.analyzeCoinsList(results);

            // 2- ترتيب النتائج بالنقاط وأخذ أفضل maxCoins فقط
            const sortedResults = results.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score; // النقاط أولاً
                }
                if (b.priority !== a.priority) {
                    return b.priority - a.priority; // ثم الأولوية
                }
                return b.change24h - a.change24h; // ثم التغيير اليومي
            });

            this.coins = sortedResults.slice(0, this.config.maxCoins);

            // 3- إعادة الترتيب التسلسلي 1 → n
            this.coins.forEach((coin, idx) => {
                coin.rank = idx + 1;
            });

            console.log(`🎉 تم تحليل وترتيب ${this.coins.length} عملة بنجاح وعرض أفضلها فقط`);

        } catch (error) {
            console.error('💥 خطأ في fetchData:', error);
            this.showError(`خطأ في جلب البيانات: ${error.message}`);
            throw error;
        }
    }

    // دالة تحليل قائمة كاملة من العملات (حتى يمكن ترتيبها بالنقاط)
    analyzeCoinsList(coinsList) {
        coinsList.forEach((coin, index) => {
            // حساب النقاط بناءً على المؤشرات الفنية
            let score = 0;
            const indicators = coin.technicalIndicators;
            
            // نقاط RSI
            if (indicators.rsi >= 30 && indicators.rsi <= 70) {
                score += 20;
            } else if (indicators.rsi < 30) {
                score += 30;
            }
            // نقاط MACD
            if (indicators.macd > indicators.macdSignal) {
                score += 25;
            }
            // نقاط MFI
            if (indicators.mfi >= 20 && indicators.mfi <= 80) {
                score += 15;
            }
            // نقاط CVD
            if (indicators.cvd.trend === 'bullish') {
                score += 20;
                if (indicators.cvd.strength === 'strong') {
                    score += 10;
                }
            }
            // نقاط التغيير اليومي
            if (coin.change24h > 0) {
                score += Math.min(coin.change24h * 2, 30);
            }
            // نقاط الأولوية
            if (coin.priority === 3) {
                score += 15;
            }
            coin.score = Math.round(score);

            // تحديد الشروط
            coin.conditions = {
                rsiGood: indicators.rsi >= 30 && indicators.rsi <= 70,
                macdBullish: indicators.macd > indicators.macdSignal,
                mfiHealthy: indicators.mfi >= 20 && indicators.mfi <= 80,
                cvdBullish: indicators.cvd.trend === 'bullish',
                priceAboveEMA: coin.price > indicators.ema20,
                volumeGood: coin.volume > this.config.minVolume,
                changePositive: coin.change24h > 0,
                multiSource: coin.priority === 3
            };

            // أهداف فيبوناتشي
            coin.targets = {
                target1: indicators.fibonacci.level236,
                target2: indicators.fibonacci.level382,
                target3: indicators.fibonacci.level500,
                stopLoss: indicators.parabolicSAR
            };
        });
    }

    // الدالة القديمة لتحليل العملات (ستخدم فقط للعرض النهائي)
    analyzeCoins() {
        // لا تحتاج فعل أي شيء هنا لأن التحليل تم مسبقاً في analyzeCoinsList
        // فقط إعادة الترتيب (احتياط)
        this.coins.sort((a, b) => b.score - a.score);
        this.coins.forEach((coin, idx) => {
            coin.rank = idx + 1;
        });
    }

    // باقي الدوال كما هي...
    mergeDuplicateSymbols(candidateSymbols) {
        const symbolMap = new Map();
        candidateSymbols.forEach(({ symbol, source }) => {
            if (symbolMap.has(symbol)) {
                symbolMap.get(symbol).priority = 3;
                symbolMap.get(symbol).sources.push(source);
            } else {
                symbolMap.set(symbol, {
                    symbol,
                    source,
                    sources: [source],
                    priority: 1
                });
            }
        });
        return Array.from(symbolMap.values());
    }

    async fetchTopGainersFromOKX() {
        try {
            console.log('جاري جلب قائمة أعلى الرابحون من OKX...');
            const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`فشل في جلب البيانات: ${response.status}`);
            }
            const data = await response.json();
            if (!data.data || data.data.length === 0) {
                throw new Error('لا توجد بيانات من OKX API');
            }
            const usdtPairs = data.data
                .filter(ticker => {
                    if (!ticker.instId || !ticker.instId.endsWith('-USDT')) return false;
                    const currentPrice = parseFloat(ticker.last);
                    const openPrice = parseFloat(ticker.open24h);
                    const volume = parseFloat(ticker.vol24h);
                    if (!currentPrice || !openPrice || currentPrice <= 0 || openPrice <= 0) return false;
                    const change24h = ((currentPrice - openPrice) / openPrice) * 100;
                    const validChange = change24h > 0.5 && change24h < 25;
                    const validVolume = volume > 10000;
                    return validChange && validVolume;
                })
                .map(ticker => ticker.instId.replace('-USDT', ''))
                .slice(0, 12);
            return usdtPairs;
        } catch (error) {
            console.error('❌ خطأ في fetchTopGainersFromOKX:', error);
            throw error;
        }
    }

    async fetchTopGainersFromBinance() {
        try {
            console.log('جاري جلب قائمة أعلى الرابحون من Binance...');
            const response = await fetch('https://api1.binance.com/api/v3/ticker/24hr', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`فشل في جلب البيانات من Binance: ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('لا توجد بيانات من Binance API');
            }
            const usdtPairs = data
                .filter(ticker => {
                    if (!ticker.symbol || !ticker.symbol.endsWith('USDT')) return false;
                    const change24h = parseFloat(ticker.priceChangePercent);
                    const volume = parseFloat(ticker.quoteVolume);
                    const price = parseFloat(ticker.lastPrice);
                    if (isNaN(change24h) || isNaN(volume) || isNaN(price) || price <= 0) return false;
                    const validChange = change24h > 0.5 && change24h < 25;
                    const validVolume = volume > 10000;
                    return validChange && validVolume;
                })
                .map(ticker => ticker.symbol.replace('USDT', ''))
                .slice(0, 12);
            return usdtPairs;
        } catch (error) {
            console.error('❌ خطأ في fetchTopGainersFromBinance:', error);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchCoinData(symbol, source = 'okx') {
        try {
            if (source === 'binance') {
                return await this.fetchCoinDataFromBinance(symbol);
            } else {
                return await this.fetchCoinDataFromOKX(symbol);
            }
        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol} من ${source}:`, error);
            throw error;
        }
    }

    async fetchCoinDataFromOKX(symbol) {
        try {
            const apiUrl = `https://www.okx.com/api/v5/market/ticker?instId=${symbol}-USDT`;
            const candlesUrl = `https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=1H&limit=100`;
            const tickerResponse = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            if (!tickerResponse.ok) {
                throw new Error(`HTTP ${tickerResponse.status}: ${tickerResponse.statusText}`);
            }
            const tickerData = await tickerResponse.json();
            if (!tickerData.data || tickerData.data.length === 0) {
                throw new Error(`لا توجد بيانات لـ ${symbol}`);
            }
            await this.delay(100);
            const candlesResponse = await fetch(candlesUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            let historicalData = [];
            if (candlesResponse.ok) {
                const candlesData = await candlesResponse.json();
                if (candlesData.data && candlesData.data.length > 0) {
                    historicalData = candlesData.data.map(candle => ({
                        timestamp: parseInt(candle[0]),
                        open: parseFloat(candle[1]),
                        high: parseFloat(candle[2]),
                        low: parseFloat(candle[3]),
                        close: parseFloat(candle[4]),
                        volume: parseFloat(candle[5]),
                        volumeQuote: parseFloat(candle[6])
                    }));
                }
            }
            const ticker = tickerData.data[0];
            const currentPrice = parseFloat(ticker.last);
            const openPrice24h = parseFloat(ticker.open24h);
            const change24h = parseFloat(ticker.changePercent) || (openPrice24h > 0 ? ((currentPrice - openPrice24h) / openPrice24h) * 100 : 0);
            const coin = {
                symbol: symbol,
                name: symbol,
                price: currentPrice,
                change24h: change24h,
                volume: parseFloat(ticker.vol24h) || 0,
                high24h: parseFloat(ticker.high24h) || currentPrice,
                low24h: parseFloat(ticker.low24h) || currentPrice,
                historicalData: historicalData,
                technicalIndicators: {},
                score: 0,
                rank: 0,
                conditions: {},
                targets: {},
                dataSource: 'okx'
            };
            this.calculateTechnicalIndicators(coin);
            return coin;
        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol} من OKX:`, error);
            throw error;
        }
    }

    async fetchCoinDataFromBinance(symbol) {
        try {
            const tickerUrl = `https://api1.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`;
            const klinesUrl = `https://api1.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=100`;
            const tickerResponse = await fetch(tickerUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            if (!tickerResponse.ok) {
                throw new Error(`HTTP ${tickerResponse.status}: ${tickerResponse.statusText}`);
            }
            const tickerData = await tickerResponse.json();
            await this.delay(100);
            const klinesResponse = await fetch(klinesUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            let historicalData = [];
            if (klinesResponse.ok) {
                const klinesData = await klinesResponse.json();
                if (Array.isArray(klinesData) && klinesData.length > 0) {
                    historicalData = klinesData.map(kline => ({
                        timestamp: kline[0],
                        open: parseFloat(kline[1]),
                        high: parseFloat(kline[2]),
                        low: parseFloat(kline[3]),
                        close: parseFloat(kline[4]),
                        volume: parseFloat(kline[5]),
                        volumeQuote: parseFloat(kline[7])
                    }));
                }
            }
            const currentPrice = parseFloat(tickerData.lastPrice);
            const change24h = parseFloat(tickerData.priceChangePercent);
            const coin = {
                symbol: symbol,
                name: symbol,
                price: currentPrice,
                change24h: change24h,
                volume: parseFloat(tickerData.quoteVolume) || 0,
                high24h: parseFloat(tickerData.highPrice) || currentPrice,
                low24h: parseFloat(tickerData.lowPrice) || currentPrice,
                historicalData: historicalData,
                technicalIndicators: {},
                score: 0,
                rank: 0,
                conditions: {},
                targets: {},
                dataSource: 'binance'
            };
            this.calculateTechnicalIndicators(coin);
            return coin;
        } catch (error) {
            console.error(`خطأ في جلب بيانات ${symbol} من Binance:`, error);
            throw error;
        }
    }

    calculateTechnicalIndicators(coin) {
        const historicalData = coin.historicalData || [];
        if (historicalData.length >= 14) {
            coin.technicalIndicators.rsi = this.calculateRSI(historicalData);
        } else {
            coin.technicalIndicators.rsi = 50 + (coin.change24h * 0.8);
            if (coin.technicalIndicators.rsi > 100) coin.technicalIndicators.rsi = 100;
            if (coin.technicalIndicators.rsi < 0) coin.technicalIndicators.rsi = 0;
        }
        if (historicalData.length >= 26) {
            const macdData = this.calculateMACD(historicalData);
            coin.technicalIndicators.macd = macdData.macd;
            coin.technicalIndicators.macdSignal = macdData.signal;
        } else {
            coin.technicalIndicators.macd = coin.change24h > 0 ? 0.1 : -0.1;
            coin.technicalIndicators.macdSignal = 0;
        }
        if (historicalData.length >= 14) {
            coin.technicalIndicators.mfi = this.calculateMFI(historicalData);
        } else {
            coin.technicalIndicators.mfi = Math.min(100, 50 + (coin.change24h * 1.2));
        }
        coin.technicalIndicators.cvd = this.calculateCVD(historicalData, coin);
        if (historicalData.length >= 2) {
            coin.technicalIndicators.parabolicSAR = this.calculateParabolicSAR(historicalData);
        } else {
            coin.technicalIndicators.parabolicSAR = coin.price * 0.98;
        }
        const currentPrice = coin.price;
        if (historicalData.length >= 50) {
            coin.technicalIndicators.ema20 = this.calculateEMA(historicalData, 20);
            coin.technicalIndicators.ema50 = this.calculateEMA(historicalData, 50);
        } else {
            coin.technicalIndicators.ema20 = currentPrice;
            coin.technicalIndicators.ema50 = currentPrice * (1 - (coin.change24h / 100) * 0.3);
        }
        const low24h = currentPrice * (1 - (coin.change24h / 100));
        const high24h = currentPrice;
        const range = high24h - low24h;
        coin.technicalIndicators.fibonacci = {
            level0: high24h,
            level236: high24h + (range * 0.236),
            level382: high24h + (range * 0.382),
            level500: high24h + (range * 0.500),
            level618: high24h + (range * 0.618),
            level786: low24h + (range * 0.214),
            level1000: low24h
        };
    }

    calculateRSI(historicalData, period = 14) {
        if (historicalData.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = historicalData[i].close - historicalData[i - 1].close;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }
        let avgGain = gains / period, avgLoss = losses / period;
        for (let i = period + 1; i < historicalData.length; i++) {
            const change = historicalData[i].close - historicalData[i - 1].close;
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? Math.abs(change) : 0;
            avgGain = ((avgGain * (period - 1)) + gain) / period;
            avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        }
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateMACD(historicalData, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (historicalData.length < slowPeriod) return { macd: 0, signal: 0 };
        const prices = historicalData.map(d => d.close);
        const ema12 = this.calculateEMAFromPrices(prices, fastPeriod);
        const ema26 = this.calculateEMAFromPrices(prices, slowPeriod);
        const macdLine = ema12 - ema26;
        const signalLine = macdLine * 0.1;
        return { macd: macdLine, signal: signalLine };
    }

    calculateMFI(historicalData, period = 14) {
        if (historicalData.length < period + 1) return 50;
        let positiveFlow = 0, negativeFlow = 0;
        for (let i = 1; i <= period; i++) {
            const current = historicalData[i], previous = historicalData[i - 1];
            const typicalPrice = (current.high + current.low + current.close) / 3;
            const previousTypicalPrice = (previous.high + previous.low + previous.close) / 3;
            const moneyFlow = typicalPrice * current.volume;
            if (typicalPrice > previousTypicalPrice) positiveFlow += moneyFlow;
            else if (typicalPrice < previousTypicalPrice) negativeFlow += moneyFlow;
        }
        if (negativeFlow === 0) return 100;
        const moneyFlowRatio = positiveFlow / negativeFlow;
        return 100 - (100 / (1 + moneyFlowRatio));
    }

    calculateCVD(historicalData, coin) {
        if (!historicalData || historicalData.length === 0) {
            const volumeDirection = coin.change24h > 0 ? 1 : -1;
            return {
                value: coin.volume * volumeDirection,
                trend: coin.change24h > 0 ? 'bullish' : 'bearish',
                strength: Math.abs(coin.change24h) > 5 ? 'strong' : 'weak'
            };
        }
        let cvd = 0, previousCvd = 0;
        for (let i = 1; i < historicalData.length; i++) {
            const current = historicalData[i], previous = historicalData[i - 1];
            let volumeDirection;
            if (current.close > previous.close) volumeDirection = 1;
            else if (current.close < previous.close) volumeDirection = -1;
            else volumeDirection = 0;
            cvd += current.volume * volumeDirection;
        }
        const trend = cvd > previousCvd ? 'bullish' : 'bearish';
        const strength = Math.abs(cvd) > (coin.volume * 10) ? 'strong' : 'weak';
        return { value: cvd, trend, strength };
    }

    calculateParabolicSAR(historicalData) {
        if (historicalData.length < 2) return historicalData[0]?.close || 0;
        const current = historicalData[historicalData.length - 1];
        const previous = historicalData[historicalData.length - 2];
        const af = 0.02;
        const trend = current.close > previous.close ? 'up' : 'down';
        if (trend === 'up') {
            return current.low - (current.high - current.low) * af;
        } else {
            return current.high + (current.high - current.low) * af;
        }
    }

    calculateEMA(historicalData, period) {
        if (historicalData.length < period) {
            return historicalData[historicalData.length - 1]?.close || 0;
        }
        const prices = historicalData.map(d => d.close);
        return this.calculateEMAFromPrices(prices, period);
    }

    calculateEMAFromPrices(prices, period) {
        if (prices.length < period) {
            return prices[prices.length - 1] || 0;
        }
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
        for (let i = period; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    }

    renderCoins() {
        const coinsGrid = document.getElementById('coinsGrid');
        if (!coinsGrid) {
            console.error('عنصر coinsGrid غير موجود');
            return;
        }
        if (this.coins.length === 0) {
            coinsGrid.innerHTML = '<div class="no-data">لا توجد عملات للعرض</div>';
            return;
        }
        let html = '';
        this.coins.forEach(coin => {
            let rankIcon = '', rankClass = '';
            if (coin.rank === 1) {
                rankIcon = '🥇';
                rankClass = 'first-place';
            } else if (coin.rank === 2) {
                rankIcon = '🥈';
                rankClass = 'second-place';
            } else if (coin.rank === 3) {
                rankIcon = '🥉';
                rankClass = 'third-place';
            } else {
                rankIcon = `#${coin.rank}`;
                rankClass = 'other-place';
            }
            const sourceIcon = coin.dataSource === 'binance' ? '🟡' : '🔵';
            const priorityBadge = coin.priority === 3 ? '<span class="multi-source">⭐</span>' : '';
            let scoreClass = '';
            if (coin.score >= 90) scoreClass = 'score-excellent';
            else if (coin.score >= 80) scoreClass = 'score-very-good';
            else if (coin.score >= 70) scoreClass = 'score-good';
            else if (coin.score >= 60) scoreClass = 'score-average';
            else scoreClass = 'score-poor';
            html += `
               <div class="coin-card ${rankClass}" onclick="window.location.href='coin.html?symbol=${coin.symbol}'">
                    <div class="rank-badge">
                        <span class="rank-icon">${rankIcon}</span>
                    </div>
                    <div class="coin-header">
                        <div class="coin-symbol">
                            ${sourceIcon} ${coin.symbol} ${priorityBadge}
                        </div>
                        <div class="coin-score ${scoreClass}">
                            ${coin.score}
                        </div>
                    </div>
                    <div class="coin-price">
                        $${coin.price.toFixed(6)}
                    </div>
                    <div class="coin-change ${coin.change24h >= 0 ? 'positive' : 'negative'}">
                        ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
                    </div>
                    <div class="coin-volume">
                        الحجم: ${this.formatNumber(coin.volume)}
                    </div>
                </div>
            `;
        });
        localStorage.setItem('yaserCryptoCoins', JSON.stringify(this.coins));
        coinsGrid.innerHTML = html;
        console.log('✅ تم عرض البطاقات بنجاح');
    }

    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toFixed(0);
    }
}

// تشغيل التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 بدء تشغيل محلل العملات المشفرة - نسخة مطورة مع مصادر متعددة');
    window.yaserCryptoInstance = new YaserCrypto();
    document.addEventListener('DOMContentLoaded', function() {
    // ... كل كودك السابق هنا ...

    // إضافة زر المشاركة
    const shareBtn = document.getElementById('shareAsImageBtn');
    if (shareBtn) {
        shareBtn.onclick = function() {
            // حدد العنصر الذي تريد تصويره (تفاصيل العملة)
            const detailsDiv = document.getElementById('coinDetails');
            if (!detailsDiv) {
                alert("لم يتم العثور على تفاصيل العملة!");
                return;
            }
            html2canvas(detailsDiv).then(canvas => {
                // تحميل الصورة
                const imgData = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = imgData;
                link.download = 'recommendation.png';
                link.click();
                // فتح نافذة تويتر
                const tweetText = encodeURIComponent("توصية عملة مميزة من YASER CRYPTO! 🚀 #Crypto #توصيات_عملات");
                const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
                window.open(tweetUrl, '_blank');
                // تنبيه للمستخدم
                setTimeout(() => {
                    alert("تم حفظ صورة التوصية!\nيرجى رفع الصورة في التغريدة يدويًا.");
                }, 700);
            });
        }
    }
});
});
