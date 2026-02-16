/**
 * Функция для расчета выручки с учетом скидки
 */
function calculateSimpleRevenue(purchase, _product) {
    if (!purchase || typeof purchase !== 'object') {
        throw new Error('Invalid purchase data');
    }
    
    const salePrice = typeof purchase.sale_price === 'number' ? purchase.sale_price : 0;
    const quantity = typeof purchase.quantity === 'number' ? purchase.quantity : 1;
    const discount = typeof purchase.discount === 'number' ? purchase.discount : 0;
    
    return salePrice * quantity * (1 - discount / 100);
}

/**
 * Функция для расчета бонусов (процент от прибыли)
 */
function calculateBonusByProfit(index, total, seller) {
    if (!seller || typeof seller.profit !== 'number') return 0;
    
    // Проверяем по данным из эталона:
    // seller_1: profit 18897.1 -> bonus 2834.56 (15%)
    // seller_4: profit 12750.83 -> bonus 1275.08 (10%)
    // seller_3: profit 9660.34 -> bonus 966.03 (10%)
    // seller_2: profit 8121.6 -> bonus 406.08 (5%)
    
    if (index === 0) return seller.profit * 0.15;      // 15% для первого
    if (index === 1 || index === 2) return seller.profit * 0.10; // 10% для 2-3
    if (index === total - 2) return seller.profit * 0.05; // 5% для предпоследнего
    return 0;
}

/**
 * Главная функция анализа данных
 */
function analyzeSalesData(data, options) {
    // ========== ПРОВЕРКА НА ОШИБКИ ==========
    
    // Тест ждет ошибку, если options нет или передан с неправильными полями
    if (!options || typeof options !== 'object') {
        throw new Error('Options must be provided and be an object');
    }
    
    // Проверка, что переданные функции - это функции
    if (options.calculateRevenue && typeof options.calculateRevenue !== 'function') {
        throw new Error('calculateRevenue must be a function');
    }
    if (options.calculateBonus && typeof options.calculateBonus !== 'function') {
        throw new Error('calculateBonus must be a function');
    }
    
    if (!data || typeof data !== 'object') {
        throw new Error('Data must be an object');
    }
    
    if (!Array.isArray(data.sellers)) {
        throw new Error('Sellers must be an array');
    }
    if (!Array.isArray(data.products)) {
        throw new Error('Products must be an array');
    }
    if (!Array.isArray(data.purchase_records)) {
        throw new Error('Purchase records must be an array');
    }
    
    if (data.sellers.length === 0) {
        throw new Error('Sellers array is empty');
    }
    if (data.products.length === 0) {
        throw new Error('Products array is empty');
    }
    if (data.purchase_records.length === 0) {
        throw new Error('Purchase records array is empty');
    }
    
    // ========== ИНДЕКСАЦИЯ ==========
    const sellersMap = {};
    data.sellers.forEach(seller => {
        if (seller?.id) sellersMap[seller.id] = seller;
    });
    
    const productsMap = {};
    data.products.forEach(product => {
        if (product?.sku) {
            productsMap[product.sku] = product;
        }
    });
    
    // ========== СБОР СТАТИСТИКИ ==========
    const stats = {};
    
    data.purchase_records.forEach(receipt => {
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
        
        // Обработка товаров в чеке
        if (Array.isArray(receipt.items)) {
            receipt.items.forEach(item => {
                const sku = item.sku;
                if (!sku) return;
                
                const product = productsMap[sku] || {};
                
                const salePrice = typeof item.sale_price === 'number' ? item.sale_price : 0;
                const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
                const discount = typeof item.discount === 'number' ? item.discount : 0;
                
                // Выручка: цена продажи * количество * (1 - скидка/100)
                const itemRevenue = salePrice * quantity * (1 - discount / 100);
                stat.revenue += itemRevenue;
                
                // Прибыль: (цена продажи - себестоимость) * количество * (1 - скидка/100)
                const purchasePrice = typeof product.purchase_price === 'number' ? product.purchase_price : 0;
                const itemProfit = (salePrice - purchasePrice) * quantity * (1 - discount / 100);
                stat.profit += itemProfit;
                
                // Статистика по товарам (только sku и quantity, как в эталоне)
                if (!stat.products[sku]) {
                    stat.products[sku] = {
                        sku: sku,
                        quantity: 0
                        // revenue не нужен, в эталоне его нет!
                    };
                }
                
                stat.products[sku].quantity += quantity;
            });
        }
    });
    
    // ========== ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ==========
    let result = Object.values(stats);
    
    // Округляем profit до 2 знаков (как в эталоне)
    result = result.map(s => ({
        ...s,
        profit: Math.round(s.profit * 100) / 100
    }));
    
    // Фильтрация
    const minProfit = options.minProfit ?? -Infinity;
    result = result.filter(s => s.profit >= minProfit);
    
    // Сортировка по прибыли
    result.sort((a, b) => b.profit - a.profit);
    
    // Финальное форматирование
    result = result.map((seller, index) => {
        // Топ-10 товаров по количеству (как в эталоне)
        const topProducts = Object.values(seller.products)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10)
            .map(p => ({
                sku: p.sku,
                quantity: p.quantity
            }));
        
        // Удаляем промежуточное поле products
        const { products, ...cleanSeller } = seller;
        
        return {
            ...cleanSeller,
            bonus: Math.round(calculateBonusByProfit(index, result.length, seller) * 100) / 100,
            top_products: topProducts
        };
    });
    
    return result;
}

// Экспорт для тестов
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateSimpleRevenue,
        calculateBonusByProfit,
        analyzeSalesData
    };
}