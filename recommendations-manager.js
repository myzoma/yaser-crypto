class RecommendationsManager {
    constructor() {
        this.storageKey = 'crypto_recommendations';
        this.reportsKey = 'crypto_reports';
        this.lastCopyKey = 'last_copy_time';
        this.init();
    }

    init() {
        setTimeout(() => {
            this.checkAndCopyRecommendations();
        }, 10000);
        
        if (window.location.search.includes('admin=true')) {
            this.showAdminPanel();
        }
    }

    checkAndCopyRecommendations() {
        const lastCopyTime = localStorage.getItem(this.lastCopyKey);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (!lastCopyTime || (now - parseInt(lastCopyTime)) >= twentyFourHours) {
            this.copyCurrentRecommendations();
        }
    }

    copyCurrentRecommendations() {
        try {
            const yaserCrypto = window.yaserCryptoInstance;
            if (!yaserCrypto || !yaserCrypto.coins || yaserCrypto.coins.length === 0) {
                console.log('No data to copy');
                return;
            }

            const recommendations = yaserCrypto.coins.map(coin => ({
                symbol: coin.symbol,
                copyTime: Date.now(),
                originalPrice: parseFloat(coin.price) || 0,
                targets: coin.targets || {},
                status: 'pending',
                currentPrice: parseFloat(coin.price) || 0
            }));

            localStorage.setItem(this.storageKey, JSON.stringify(recommendations));
            localStorage.setItem(this.lastCopyKey, Date.now().toString());
            console.log('Copied recommendations:', recommendations.length);
        } catch (error) {
            console.error('Copy error:', error);
        }
    }

    showAdminPanel() {
        document.body.innerHTML = `
            <div style="padding: 20px; font-family: Arial; direction: rtl;">
                <h1>مدير التوصيات</h1>
                <a href="?" style="background: #007bff; color: white; padding: 10px; text-decoration: none; border-radius: 5px;">العودة للموقع</a>
                <div id="recommendations" style="margin-top: 20px;"></div>
            </div>
        `;
        this.loadRecommendations();
    }

    loadRecommendations() {
        const data = localStorage.getItem(this.storageKey);
        const recommendations = data ? JSON.parse(data) : [];
        const container = document.getElementById('recommendations');
        
        if (recommendations.length === 0) {
            container.innerHTML = '<p>لا توجد توصيات</p>';
            return;
        }

        let html = '<table border="1" style="width: 100%; border-collapse: collapse;"><tr><th>العملة</th><th>السعر</th><th>التاريخ</th></tr>';
        recommendations.forEach(rec => {
            html += `<tr><td>${rec.symbol}</td><td>$${rec.originalPrice}</td><td>${new Date(rec.copyTime).toLocaleString()}</td></tr>`;
        });
        html += '</table>';
        container.innerHTML = html;
    }
}

if (!window.recommendationsManager) {
    window.recommendationsManager = new RecommendationsManager();
}
