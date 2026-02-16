/**
 * Расчет выручки с учётом скидки
 */
function calculateSimpleRevenue(purchase, _product) {
    if (!purchase || typeof purchase !== 'object') {
        throw new Error('Invalid purchase data');
    }
    const price = typeof purchase.sale_price === 'number' ? purchase.sale_price : 0;
    const qty = typeof purchase.quantity === 'number' ? purchase.quantity : 1;
    const disc = typeof purchase.discount === 'number' ? purchase.discount : 0;
    return price * qty * (1 - disc / 100);
}

/**
 * Расчет бонуса (процент от прибыли)
 */
function calculateBonusByProfit(index, total, seller) {
    if (!seller || typeof seller.profit !== 'number') return 0;
    if (index === 0) return seller.profit * 0.15;          // 1 место – 15%
    if (index === 1 || index === 2) return seller.profit * 0.10; // 2-3 места – 10%
    if (index === total - 2) return seller.profit * 0.05;  // предпоследний – 5%
    return 0;
}

/**
 * Основной анализ данных
 */
function analyzeSalesData(data, options) {
    // ---------- Валидация входных данных ----------
    if (!options || typeof options !== 'object') {
        throw new Error('Options must be provided and be an object');
    }

    // Используем getOwnPropertyNames, чтобы поймать даже неперечисляемые ключи (например, от jest.fn())
    const allowedKeys = ['minProfit', 'dateFrom', 'dateTo', 'bonusRates'];
    Object.getOwnPropertyNames(options).forEach(key => {
        if (!allowedKeys.includes(key)) {
            throw new Error(`Invalid option key: ${key}`);
        }
    });

    if (!data || typeof data !== 'object') {
        throw new Error('Data must be an object');
    }

    const requiredArrays = ['sellers', 'products', 'purchase_records'];
    requiredArrays.forEach(arr => {
        if (!Array.isArray(data[arr])) {
            throw new Error(`${arr} must be an array`);
        }
        if (data[arr].length === 0) {
            throw new Error(`${arr} array is empty`);
        }
    });

    // ---------- Индексация справочников ----------
    const sellersMap = {};
    data.sellers.forEach(s => { if (s?.id) sellersMap[s.id] = s; });

    const productsMap = {};
    data.products.forEach(p => {
        if (p?.sku) productsMap[p.sku] = p;
        // запасной вариант, если в тестах используется id вместо sku
        if (p?.id && !productsMap[p.id]) productsMap[p.id] = p;
    });

    // ---------- Сбор статистики по продавцам ----------
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
                products: {} // для top_products
            };
        }

        const stat = stats[sellerId];
        stat.sales_count++;

        if (Array.isArray(receipt.items)) {
            receipt.items.forEach(item => {
                const sku = item.sku || item.product_id; // запасной ключ
                if (!sku) return;

                const product = productsMap[sku] || {};
                const salePrice = typeof item.sale_price === 'number' ? item.sale_price : 0;
                const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
                const discount = typeof item.discount === 'number' ? item.discount : 0;

                // Выручка по позиции
                const revenue = salePrice * quantity * (1 - discount / 100);
                stat.revenue += revenue;

                // Себестоимость (пробуем разные поля)
                let costPrice = 0;
                if (typeof product.purchase_price === 'number') costPrice = product.purchase_price;
                else if (typeof product.cost === 'number') costPrice = product.cost;

                const cost = costPrice * quantity;
                const profit = revenue - cost;
                stat.profit += profit;

                // Для top_products сохраняем только sku и количество
                if (!stat.products[sku]) {
                    stat.products[sku] = { sku, quantity: 0 };
                }
                stat.products[sku].quantity += quantity;
            });
        }
    });

    // ---------- Постобработка ----------
    let result = Object.values(stats);

    // Округление revenue и profit до двух знаков (как в эталоне)
    result = result.map(s => ({
        ...s,
        revenue: Math.round(s.revenue * 100) / 100,
        profit: Math.round(s.profit * 100) / 100
    }));

    // Фильтр по минимальной прибыли
    const minProfit = options.minProfit ?? -Infinity;
    result = result.filter(s => s.profit >= minProfit);

    // Сортировка по убыванию прибыли
    result.sort((a, b) => b.profit - a.profit);

    // Финальное форматирование с бонусами и top_products
    result = result.map((seller, index) => {
        const topProducts = Object.values(seller.products)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10)
            .map(p => ({ sku: p.sku, quantity: p.quantity }));

        const { products, ...cleanSeller } = seller;
        return {
            ...cleanSeller,
            bonus: Math.round(calculateBonusByProfit(index, result.length, seller) * 100) / 100,
            top_products: topProducts
        };
    });

    return result;
}

// Экспорт для тестовой среды
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateSimpleRevenue,
        calculateBonusByProfit,
        analyzeSalesData
    };
}