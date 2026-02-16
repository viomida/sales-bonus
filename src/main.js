function calculateSimpleRevenue(purchase, _product) {
    if (!purchase || typeof purchase !== 'object') return 0;
    return typeof purchase.total_amount === 'number' ? purchase.total_amount : 0;
}

function calculateBonusByProfit(index, total, seller) {
    if (index === 0) return 1000;
    if (index === 1) return 500;
    if (index === 2) return 250;
    return 0;
}

function analyzeSalesData(data, options = {}) {
    if (!data || typeof data !== 'object') return [];
    
    const sellers = Array.isArray(data.sellers) ? data.sellers : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const purchaseRecords = Array.isArray(data.purchase_records) ? data.purchase_records : [];
    
    const sellersMap = {};
    sellers.forEach(s => { if (s?.id) sellersMap[s.id] = s; });
    
    const productsMap = {};
    products.forEach(p => { if (p?.sku) productsMap[p.sku] = p; });
    
    const stats = {};
    
    purchaseRecords.forEach(receipt => {
        if (!receipt?.seller_id) return;
        
        const sellerId = receipt.seller_id;
        
        if (!stats[sellerId]) {
            const seller = sellersMap[sellerId] || {};
            stats[sellerId] = {
                seller_id: sellerId,
                name: `${seller.first_name || ''} ${seller.last_name || ''}`.trim() || `Продавец ${sellerId}`,
                sales_count: 0,
                revenue: 0,
                profit: 0,
                products: {}
            };
        }
        
        const stat = stats[sellerId];
        stat.sales_count++;
        
        const receiptTotal = typeof receipt.total_amount === 'number' ? receipt.total_amount : 0;
        stat.revenue += receiptTotal;
        stat.profit += receiptTotal;
        
        if (Array.isArray(receipt.items)) {
            receipt.items.forEach(item => {
                const sku = item.sku;
                if (!sku) return;
                
                const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
                const itemTotal = (typeof item.sale_price === 'number' ? item.sale_price : 0) * quantity;
                
                if (!stat.products[sku]) {
                    const product = productsMap[sku] || {};
                    stat.products[sku] = {
                        id: sku,
                        name: product.name || `Товар ${sku}`,
                        quantity: 0,
                        revenue: 0
                    };
                }
                
                stat.products[sku].quantity += quantity;
                stat.products[sku].revenue += itemTotal;
            });
        }
    });
    
    let result = Object.values(stats);
    
    const minProfit = options.minProfit ?? -Infinity;
    result = result.filter(s => s.profit >= minProfit);
    result.sort((a, b) => b.profit - a.profit);
    
    result = result.map((seller, index) => {
        const topProducts = Object.values(seller.products)
            .filter(p => p.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3)
            .map(p => ({ id: p.id, name: p.name }));
        
        const { products, ...cleanSeller } = seller;
        
        return {
            ...cleanSeller,
            bonus: calculateBonusByProfit(index, result.length, seller),
            top_products: topProducts
        };
    });
    
    return result;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateSimpleRevenue,
        calculateBonusByProfit,
        analyzeSalesData
    };
}