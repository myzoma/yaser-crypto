class YaserCrypto {
    constructor() {
        this.coins = [];
        this.coinHistory = new Map(); // جديد: لتتبع تاريخ العملات
        this.config = {
            apiUrl: "https://www.okx.com/api/v5",
            requestDelay: 500,
            maxCoins: 30, // تعديل: من 50 إلى 30
            minChange: 5, // تعديل: من 1 إلى 5 (العملات الجديدة تبدأ من 5-7%)
            maxChange: 15,
            minVolume: 100000,
            refreshInterval: 30000, // جديد: 30 ثانية
            warningDropPercent: 3, // جديد: تحذير عند فقدان 3%
            removeDropPercent: 7, // جديد: حذف عند فقدان 7%
            changeWeight: 0.8, // جديد: وزن نسبة التغيير 80%
            technicalWeight: 0.2 // جديد: وزن التحليل الفني 20%
        };
        this.requestDelay = 500;
        this.init();
    }

    async init() {
        this.showLoading();
        await this.fetchData();
        this.analyzeCoins();
        this.renderCoins();
        
        // بدء التحديث التلقائي
        this.startAutoUpdate();
    }

    // دالة جديدة للتحديث التلقائي
    startAutoUpdate() {
        console.log(`🔄 بدء التحديث التلقائي كل ${this.config.refreshInterval / 1000} ثانية`);
        
        setInterval(async () => {
            try {
                console.log('🔄 تحديث تلقائي...');
                await this.fetchData();
                this.analyzeCoins();
                this.renderCoins();
                console.log('✅ تم التحديث بنجاح');
            } catch (error) {
                console.error('❌ خطأ في التحديث التلقائي:', error);
            }
        }, this.config.refreshInterval);
    }

    showLoading() {
        document.getElementById('coinsGrid').innerHTML = '<div class="loading">يتم التحليل الان .. انتظر قليلا من فضلك ؟...</div>';
    }

    showError(message) {
        document.getElementById('coinsGrid').innerHTML = `<div class="error">${message}</div>`;
    }

    async fetchData() {
        try {
            console.log('📡 جلب بيانات العملات...');
            const response = await fetch(`${this.config.apiUrl}/market/tickers?instType=SPOT`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.data || !Array.isArray(data.data)) {
                throw new Error('Invalid data format received');
            }

            this.coins = data.data
                .filter(coin => {
                    const change = parseFloat(coin.last24hPx);
                    const volume = parseFloat(coin.vol24h);
                    return change >= this.config.minChange && 
                           change <= this.config.maxChange && 
                           volume >= this.config.minVolume &&
                           coin.instId.endsWith('-USDT');
                })
                .map(coin => ({
                    symbol: coin.instId.replace('-USDT', ''),
                    name: coin.instId.replace('-USDT', ''),
                    price: parseFloat(coin.last),
                    change24h: parseFloat(coin.last24hPx),
                    volume: parseFloat(coin.vol24h),
                    high24h: parseFloat(coin.high24h),
                    low24h: parseFloat(coin.low24h),
                    technicalIndicators: {},
                    conditions: {},
                    score: 0,
                    status: 'normal' // جديد: حالة العملة
                }));

            console.log(`📊 تم جلب ${this.coins.length} عملة مرشحة`);
            
            // حساب المؤشرات الفنية
            for (const coin of this.coins) {
                await this.calculateTechnicalIndicators(coin);
                await this.delay(this.requestDelay);
            }
            
        } catch (error) {
            console.error('❌ خطأ في جلب البيانات:', error);
            this.showError(`خطأ في جلب البيانات: ${error.message}`);
        }
    }

    async calculateTechnicalIndicators(coin) {
        try {
            const response = await fetch(`${this.config.apiUrl}/market/candles?instId=${coin.symbol}-USDT&bar=1H&limit=100`);
            
            if (!response.ok) {
                console.warn(`⚠️ فشل في جلب بيانات ${coin.symbol}`);
                return;
            }
            
            const data = await response.json();
            
            if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
                console.warn(`⚠️ لا توجد بيانات كافية لـ ${coin.symbol}`);
                return;
            }

            const candles = data.data.reverse().map(candle => ({
                timestamp: parseInt(candle[0]),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));

            if (candles.length < 50) {
                console.warn(`⚠️ بيانات غير كافية لـ ${coin.symbol}: ${candles.length} شمعة فقط`);
                return;
            }

            coin.technicalIndicators = {
                rsi: this.calculateRSI(candles, 14),
                macd: this.calculateMACD(candles),
                macdSignal: this.calculateMACDSignal(candles),
                ema20: this.calculateEMA(candles, 20),
                ema50: this.calculateEMA(candles, 50),
                ma20: this.calculateMA(candles, 20),
                ma50: this.calculateMA(candles, 50),
                mfi: this.calculateMFI(candles, 14),
                parabolicSAR: this.calculateParabolicSAR(candles),
                fibonacci: this.calculateFibonacci(candles)
            };

            this.calculateTargets(coin);

        } catch (error) {
            console.error(`❌ خطأ في حساب المؤشرات لـ ${coin.symbol}:`, error);
        }
    }

    // دالة جديدة لتتبع أداء العملات
    trackCoinPerformance(coin) {
        const symbol = coin.symbol;
        const currentChange = coin.change24h;
        
        // إذا كانت العملة جديدة، احفظ أعلى نقطة لها
        if (!this.coinHistory.has(symbol)) {
            this.coinHistory.set(symbol, {
                highestChange: currentChange,
                timestamp: Date.now(),
                initialChange: currentChange
            });
            console.log(`📈 عملة جديدة ${symbol}: بدء التتبع من ${currentChange.toFixed(2)}%`);
        } else {
            const history = this.coinHistory.get(symbol);
            
            // تحديث أعلى نقطة إذا وصلت لنقطة أعلى
            if (currentChange > history.highestChange) {
                history.highestChange = currentChange;
                history.timestamp = Date.now();
                console.log(`🚀 ${symbol}: نقطة جديدة عالية ${currentChange.toFixed(2)}%`);
            }
            
            // حفظ البيانات المحدثة
            this.coinHistory.set(symbol, history);
        }
    }

    // دالة جديدة لتقييم حالة العملة
    evaluateCoinStatus(coin) {
        const symbol = coin.symbol;
        const currentChange = coin.change24h;
        
        // إذا لم تكن العملة مسجلة، اعتبرها عادية
        if (!this.coinHistory.has(symbol)) {
            return 'normal';
        }
        
        const history = this.coinHistory.get(symbol);
        const highestChange = history.highestChange;
        const dropFromHigh = highestChange - currentChange;
        
        // حساب النسبة المئوية للانخفاض
        const dropPercentage = (dropFromHigh / highestChange) * 100;
        
        console.log(`📊 ${symbol}: الحالي=${currentChange.toFixed(2)}%, الأعلى=${highestChange.toFixed(2)}%, الانخفاض=${dropPercentage.toFixed(1)}%`);
        
        // إزالة العملة إذا فقدت أكثر من 7% من أعلى نقطة
        if (dropPercentage > this.config.removeDropPercent) {
            console.log(`🗑️ ${symbol}: تم حذفها - فقدت ${dropPercentage.toFixed(1)}% من أعلى نقطة`);
            this.coinHistory.delete(symbol); // حذف من التاريخ
            return 'removed';
        }
        
        // تحذير إذا فقدت أكثر من 3% من أعلى نقطة
        if (dropPercentage > this.config.warningDropPercent) {
            console.log(`⚠️ ${symbol}: تحذير - فقدت ${dropPercentage.toFixed(1)}% من أعلى نقطة`);
            return 'warning';
        }
        
        return 'normal';
    }

    analyzeCoins() {
        console.log('🔍 بدء تحليل العملات...');
        
        // تتبع أداء العملات وتقييم حالتها
        this.coins.forEach(coin => {
            this.trackCoinPerformance(coin);
            coin.status = this.evaluateCoinStatus(coin);
            this.calculateScore(coin);
        });
        
        // إزالة العملات التي فقدت أكثر من 7% من أعلى نقطة
        this.coins = this.coins.filter(coin => coin.status !== 'removed');
        
        // تطبيق النظام الجديد للنقاط (80% تغيير + 20% تحليل فني)
        this.coins.forEach(coin => {
            const changeScore = Math.min(coin.change24h * 10, 100); // التغيير × 10 (حد أقصى 100)
            const technicalScore = coin.score || 0; // النقاط الفنية الحالية
            
            // النظام الجديد: 80% تغيير + 20% تحليل فني
            coin.newScore = (changeScore * this.config.changeWeight) + (technicalScore * this.config.technicalWeight);
            coin.score = Math.round(coin.newScore);
            
            console.log(`📊 ${coin.symbol}: تغيير=${coin.change24h.toFixed(2)}% (${changeScore.toFixed(1)} نقطة) + فني=${technicalScore} = ${coin.score} نقطة`);
        });
        
        // ترتيب العملات حسب النظام الجديد
        this.coins.sort((a, b) => {
            // أولوية للعملات الجديدة (5-7%)
            const aIsNew = a.change24h >= this.config.minChange && a.change24h <= 7;
            const bIsNew = b.change24h >= this.config.minChange && b.change24h <= 7;
            
            if (aIsNew && !bIsNew) return -1;
            if (!aIsNew && bIsNew) return 1;
            
            // ثم حسب النقاط الجديدة
            return b.score - a.score;
        });
        
        // تحديد المراكز
        for (let i = 0; i < this.coins.length; i++) {
            this.coins[i].rank = i + 1;
        }
        
        // تحديد العملات للعرض (أفضل 30 عملة)
        this.coins = this.coins.slice(0, this.config.maxCoins);
        
        console.log('🏆 الترتيب النهائي (النظام الجديد):');
        this.coins.slice(0, 10).forEach(coin => {
            const statusText = coin.status === 'warning' ? ' ⚠️' : '';
            const isNew = coin.change24h >= this.config.minChange && coin.change24h <= 7 ? ' 🆕' : '';
            console.log(`${coin.rank}. ${coin.symbol}${statusText}${isNew}: ${coin.change24h.toFixed(2)}%, النقاط=${coin.score}`);
        });
        
        console.log(`📈 إجمالي العملات المعروضة: ${this.coins.length}`);
        console.log(`🗑️ العملات المحذوفة: ${this.coinHistory.size - this.coins.length}`);
    }

    calculateScore(coin) {
        let score = 0;
        const conditions = {};
        
        const rsi = coin.technicalIndicators.rsi || 0;
        const macd = coin.technicalIndicators.macd || 0;
        const macdSignal = coin.technicalIndicators.macdSignal || 0;
        const ema20 = coin.technicalIndicators.ema20 || 0;
        const ema50 = coin.technicalIndicators.ema50 || 0;
        const mfi = coin.technicalIndicators.mfi || 0;
        const change = coin.change24h;

        // شرط 1: ارتفاع 3% - 8 نقاط
        if (change >= 3) {
            score += 8;
            conditions.rise3Percent = true;
        }

        // شرط 2: ارتفاع 4% - 12 نقطة
        if (change >= 4) {
            score += 12;
            conditions.rise4Percent = true;
        }

        // شرط 3: اختراق المتوسطات - 18 نقطة
        if (coin.price > ema20 && coin.price > ema50) {
            score += 18;
            conditions.breakoutMA = true;
        }

        // شرط 4: RSI فوق 50 - 15 نقطة
        if (rsi > 50) {
            score += 15;
            conditions.rsiBullish = true;
        }

        // شرط 5: MACD تقاطع صاعد - 22 نقطة
        if (macd > macdSignal) {
            score += 22;
            conditions.macdBullish = true;
        }

        // شرط 6: MFI فوق 50 - 25 نقطة
        if (mfi > 50) {
            score += 25;
            conditions.mfiBullish = true;
        }

        // بونص: ارتفاع قوي +7% - 20 نقطة إضافية
        if (change >= 7) {
            score += 20;
            conditions.strongRise = true;
        }

        // بونص: جميع الشروط +9% - 10 نقاط إضافية
        if (change >= 9 && Object.keys(conditions).length >= 6) {
            score += 10;
            conditions.perfectScore = true;
        }

        coin.score = score;
        coin.conditions = conditions;
        coin.achievedConditionsCount = Object.keys(conditions).length;
    }

    calculateTargets(coin) {
        const fib = coin.technicalIndicators.fibonacci;
        const currentPrice = coin.price;
        
        coin.targets = {
            entry: currentPrice,
            stopLoss: fib.level786,
            target1: fib.level236,
            target2: fib.level382,
            target3: fib.level500,
            target4: fib.level618
        };
        
        console.log(`🎯 ${coin.symbol} الأهداف المصححة: Entry=${coin.targets.entry.toFixed(6)} | T1=${coin.targets.target1.toFixed(6)} | T2=${coin.targets.target2.toFixed(6)} | T3=${coin.targets.target3.toFixed(6)} | SL=${coin.targets.stopLoss.toFixed(6)}`);
    }

    findNearestSupport(price, fib) {
        const levels = [fib.level618, fib.level500, fib.level382, fib.level236];
        let nearest = levels[0];
        let minDiff = Math.abs(price - nearest);
        
        for (const level of levels) {
            const diff = Math.abs(price - level);
            if (diff < minDiff && level < price) {
                nearest = level;
                minDiff = diff;
            }
        }
        
        return nearest;
    }

    calculateRSI(candles, period = 14) {
        if (candles.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = candles[candles.length - i].close - candles[candles.length - i - 1].close;
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

    calculateMACD(candles) {
        const ema12 = this.calculateEMA(candles, 12);
        const ema26 = this.calculateEMA(candles, 26);
        return ema12 - ema26;
    }

    calculateMACDSignal(candles) {
        return this.calculateEMA(candles, 9);
    }

    calculateEMA(candles, period) {
        if (candles.length < period) return candles[candles.length - 1]?.close || 0;
        
        const multiplier = 2 / (period + 1);
        let ema = candles.slice(0, period).reduce((sum, candle) => sum + candle.close, 0) / period;
        
        for (let i = period; i < candles.length; i++) {
            ema = (candles[i].close * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    calculateMA(candles, period) {
        if (candles.length < period) return candles[candles.length - 1]?.close || 0;
        
        const slice = candles.slice(-period);
        return slice.reduce((sum, candle) => sum + candle.close, 0) / period;
    }

    calculateMFI(candles, period = 14) {
        if (candles.length < period + 1) return 50;
        
        let positiveFlow = 0;
        let negativeFlow = 0;
        
        for (let i = candles.length - period; i < candles.length; i++) {
            const current = candles[i];
            const previous = candles[i - 1];
            
            const typicalPrice = (current.high + current.low + current.close) / 3;
            const previousTypicalPrice = (previous.high + previous.low + previous.close) / 3;
            const moneyFlow = typicalPrice * current.volume;
            
            if (typicalPrice > previousTypicalPrice) {
                positiveFlow += moneyFlow;
            } else if (typicalPrice < previousTypicalPrice) {
                negativeFlow += moneyFlow;
            }
        }
        
        if (negativeFlow === 0) return 100;
        
        const moneyFlowRatio = positiveFlow / negativeFlow;
        return 100 - (100 / (1 + moneyFlowRatio));
    }

    calculateParabolicSAR(candles) {
        if (candles.length < 2) return candles[candles.length - 1]?.close || 0;
        
        const af = 0.02;
        const maxAf = 0.2;
        let sar = candles[0].low;
        let ep = candles[0].high;
        let currentAf = af;
        let isUptrend = true;
        
        for (let i = 1; i < candles.length; i++) {
            const candle = candles[i];
            
            if (isUptrend) {
                sar = sar + currentAf * (ep - sar);
                
                if (candle.high > ep) {
                    ep = candle.high;
                    currentAf = Math.min(currentAf + af, maxAf);
                }
                
                if (candle.low < sar) {
                    isUptrend = false;
                    sar = ep;
                    ep = candle.low;
                    currentAf = af;
                }
            } else {
                sar = sar - currentAf * (sar - ep);
                
                if (candle.low < ep) {
                    ep = candle.low;
                    currentAf = Math.min(currentAf + af, maxAf);
                }
                
                if (candle.high > sar) {
                    isUptrend = true;
                    sar = ep;
                    ep = candle.high;
                    currentAf = af;
                }
            }
        }
        
        return sar;
    }

    calculateFibonacci(candles) {
        if (candles.length < 20) {
            const lastPrice = candles[candles.length - 1]?.close || 0;
            return {
                level0: lastPrice,
                level236: lastPrice * 0.764,
                level382: lastPrice * 0.618,
                level500: lastPrice * 0.5,
                level618: lastPrice * 0.382,
                level786: lastPrice * 0.214
            };
        }
        
        const recentCandles = candles.slice(-20);
        const high = Math.max(...recentCandles.map(c => c.high));
        const low = Math.min(...recentCandles.map(c => c.low));
        const range = high - low;
        
        return {
            level0: high,
            level236: high - (range * 0.236),
            level382: high - (range * 0.382),
            level500: high - (range * 0.500),
            level618: high - (range * 0.618),
            level786: high - (range * 0.786)
        };
    }

    renderCoins() {
        const grid = document.getElementById('coinsGrid');
        grid.innerHTML = '';
        
        this.coins.forEach(coin => {
            const card = this.createCoinCard(coin);
            grid.appendChild(card);
        });
        
        console.log(`🎨 تم عرض ${this.coins.length} عملة`);
    }

    createCoinCard(coin) {
        const card = document.createElement('div');
        card.className = 'coin-card';
        card.onclick = () => this.showCoinDetails(coin);
        
        const changeClass = coin.change24h >= 0 ? 'positive' : 'negative';
        const changeSign = coin.change24h >= 0 ? '+' : '';
        const liquidityPercent = Math.min((coin.technicalIndicators.mfi || 0), 100);
        
        // تحديد رمز الحالة
        const statusIcon = coin.status === 'warning' ? ' ⚠️' : '';
        
        let rankBadgeStyle = '';
        if (coin.rank === 1) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #FFD700, #FFA500); color: #000; box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);';
        } else if (coin.rank === 2) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #C0C0C0, #A8A8A8); color: #000; box-shadow: 0 0 10px rgba(192, 192, 192, 0.5);';
        } else if (coin.rank === 3) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #CD7F32, #B8860B); color: #fff; box-shadow: 0 0 10px rgba(205, 127, 50, 0.5);';
        } else if (coin.rank <= 10) {
            rankBadgeStyle = 'background: linear-gradient(45deg, #4CAF50, #45a049); color: #fff;';
        } else {
            rankBadgeStyle = 'background: linear-gradient(45deg, #666, #555); color: #fff;';
        }
        
        card.innerHTML = `
            <div class="rank-badge" style="${rankBadgeStyle}">#${coin.rank}${coin.rank === 1 ? ' 🥇' : coin.rank === 2 ? ' 🥈' : coin.rank === 3 ? ' 🥉' : ''}</div>
            <div class="coin-header">
                <div class="coin-logo">${coin.symbol.charAt(0)}</div>
                <div class="coin-info">
                    <h3>${coin.name}${statusIcon}</h3>
                    <div class="coin-price">
                        $${coin.price.toFixed(4)}
                        <span class="price-change ${changeClass}">
                            ${changeSign}${coin.change24h.toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
            <div class="coin-metrics">
                <div class="metric-row">
                    <span class="metric-label">النقاط:</span>
                    <span class="metric-value">${coin.score}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">حجم التداول:</span>
                    <span class="metric-value">${this.formatVolume(coin.volume)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">RSI:</span>
                    <span class="metric-value">${(coin.technicalIndicators.rsi || 0).toFixed(1)}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">MFI:</span>
                    <span class="metric-value">${(coin.technicalIndicators.mfi || 0).toFixed(1)}</span>
                </div>
            </div>
            <div class="score-bar">
                <div class="score-fill" style="width: ${Math.min(coin.score, 100)}%"></div>
            </div>
            <div style="margin-top: 5px; font-size: 0.8rem; color: #aaa;">شريط السيولة</div>
            <div class="liquidity-bar">
                <div class="liquidity-fill" style="width: ${liquidityPercent}%"></div>
            </div>
        `;
        
        return card;
    }

    formatVolume(volume) {
        if (volume >= 1000000) {
            return (volume / 1000000).toFixed(1) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'K';
        }
        return volume.toFixed(0);
    }

    showCoinDetails(coin) {
        const modal = document.getElementById('coinModal');
        const modalBody = document.getElementById('modalBody');
        const fib = coin.technicalIndicators.fibonacci;
        const targets = coin.targets;
        
        // تحديد رمز الحالة
        const statusIcon = coin.status === 'warning' ? ' ⚠️' : '';
        const statusText = coin.status === 'warning' ? ' (تحذير: انخفاض من أعلى نقطة)' : '';
        
        modalBody.innerHTML = `
            <div class="modal-header">
                <div class="modal-coin-logo">${coin.symbol.charAt(0)}</div>
                <h2>${coin.name}${statusIcon}</h2>
                <p>المركز: #${coin.rank} | النقاط: ${coin.score}${statusText}</p>
                <p>السعر الحالي: $${coin.price.toFixed(4)}</p>
            </div>
            <div class="technical-indicators">
                <div class="indicator-card">
                    <div class="indicator-title">RSI (14)</div>
                    <div class="indicator-value">${(coin.technicalIndicators.rsi || 0).toFixed(2)}</div>
                    <div style="color: ${coin.
                    <div style="color: ${coin.technicalIndicators.rsi > 70 ? '#ff4444' : coin.technicalIndicators.rsi < 30 ? '#44ff44' : '#ffaa00'}">${coin.technicalIndicators.rsi > 70 ? 'مشبع شراء' : coin.technicalIndicators.rsi < 30 ? 'مشبع بيع' : 'متوسط'}</div>
                </div>
                <div class="indicator-card">
                    <div class="indicator-title">MACD</div>
                    <div class="indicator-value">${(coin.technicalIndicators.macd || 0).toFixed(4)}</div>
                    <div style="color: ${coin.technicalIndicators.macd > coin.technicalIndicators.macdSignal ? '#44ff44' : '#ff4444'}">${coin.technicalIndicators.macd > coin.technicalIndicators.macdSignal ? 'إشارة شراء' : 'إشارة بيع'}</div>
                </div>
                <div class="indicator-card">
                    <div class="indicator-title">MFI (14)</div>
                    <div class="indicator-value">${(coin.technicalIndicators.mfi || 0).toFixed(2)}</div>
                    <div style="color: ${coin.technicalIndicators.mfi > 80 ? '#ff4444' : coin.technicalIndicators.mfi < 20 ? '#44ff44' : '#ffaa00'}">${coin.technicalIndicators.mfi > 80 ? 'مشبع شراء' : coin.technicalIndicators.mfi < 20 ? 'مشبع بيع' : 'متوسط'}</div>
                </div>
                <div class="indicator-card">
                    <div class="indicator-title">EMA 20</div>
                    <div class="indicator-value">$${(coin.technicalIndicators.ema20 || 0).toFixed(4)}</div>
                    <div style="color: ${coin.price > coin.technicalIndicators.ema20 ? '#44ff44' : '#ff4444'}">${coin.price > coin.technicalIndicators.ema20 ? 'فوق المتوسط' : 'تحت المتوسط'}</div>
                </div>
            </div>
            <div class="fibonacci-levels">
                <h3>مستويات فيبوناتشي</h3>
                <div class="fib-level">
                    <span>0% (أعلى نقطة):</span>
                    <span>$${fib.level0.toFixed(4)}</span>
                </div>
                <div class="fib-level">
                    <span>23.6%:</span>
                    <span>$${fib.level236.toFixed(4)}</span>
                </div>
                <div class="fib-level">
                    <span>38.2%:</span>
                    <span>$${fib.level382.toFixed(4)}</span>
                </div>
                <div class="fib-level">
                    <span>50%:</span>
                    <span>$${fib.level500.toFixed(4)}</span>
                </div>
                <div class="fib-level">
                    <span>61.8%:</span>
                    <span>$${fib.level618.toFixed(4)}</span>
                </div>
                <div class="fib-level">
                    <span>78.6% (دعم قوي):</span>
                    <span>$${fib.level786.toFixed(4)}</span>
                </div>
            </div>
            <div class="trading-targets">
                <h3>أهداف التداول</h3>
                <div class="target-row entry">
                    <span>نقطة الدخول:</span>
                    <span>$${targets.entry.toFixed(6)}</span>
                </div>
                <div class="target-row target">
                    <span>الهدف الأول:</span>
                    <span>$${targets.target1.toFixed(6)}</span>
                </div>
                <div class="target-row target">
                    <span>الهدف الثاني:</span>
                    <span>$${targets.target2.toFixed(6)}</span>
                </div>
                <div class="target-row target">
                    <span>الهدف الثالث:</span>
                    <span>$${targets.target3.toFixed(6)}</span>
                </div>
                <div class="target-row target">
                    <span>الهدف الرابع:</span>
                    <span>$${targets.target4.toFixed(6)}</span>
                </div>
                <div class="target-row stop-loss">
                    <span>وقف الخسارة:</span>
                    <span>$${targets.stopLoss.toFixed(6)}</span>
                </div>
            </div>
            <div class="conditions-met">
                <h3>الشروط المحققة</h3>
                <div class="conditions-grid">
                    ${Object.entries(coin.conditions).map(([key, value]) => {
                        const conditionNames = {
                            rise3Percent: 'ارتفاع 3%+',
                            rise4Percent: 'ارتفاع 4%+',
                            breakoutMA: 'اختراق المتوسطات',
                            rsiBullish: 'RSI إيجابي',
                            macdBullish: 'MACD إيجابي',
                            mfiBullish: 'MFI إيجابي',
                            strongRise: 'ارتفاع قوي 7%+',
                            perfectScore: 'نقاط مثالية'
                        };
                        return `<div class="condition ${value ? 'met' : 'not-met'}">
                            ${conditionNames[key] || key}: ${value ? '✅' : '❌'}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// إغلاق النافذة المنبثقة
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('coinModal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    }
    
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
});

// بدء التطبيق
document.addEventListener('DOMContentLoaded', function() {
    new YaserCrypto();
});
