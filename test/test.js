const { assert } = require('chai');
const { writeFileSync } = require('fs');
const { Builder, Browser, By, Key, until } = require('selenium-webdriver');
const config = require('../config.json');
const { getRandomInt, getUniqueRandomNumbers } = require('../modules/utils.js');
const { sendMail, createMail, createResultList } = require('../modules/mail.js');
const { 
    login, 
    getBasketValues, 
    searchProducts, 
    resetBasket, 
    selectCategory, 
    toggleMiniBasket 
} = require('../modules/common.js');

const testErrorsImages = new Map();
let driver;


after(async function () {
    //отправка отчёта
    const mail = createMail(createResultList(this.test.parent, testErrorsImages));
    await sendMail(mail, config.mailConfig)
    .catch(error => {
        writeFileSync('./index.html', mail.replace('</body>', `<p>Ошибка при отправке отчёта: ${error.response}</p></body>`));
    });
    driver.quit();
});

before(async () => {
    driver = await new Builder().forBrowser(Browser.CHROME).build();
});

afterEach(async function () {
    if (this.currentTest.state === 'failed') {
        let encodedString = await driver.takeScreenshot();
        testErrorsImages.set(this.currentTest, encodedString);
    }
});


//Тесты
describe('check admin changes from user', async () => {
    let originalNewsName = '';
    let changedNewsName = '';
    let adminWindowId = '';
    let userWindowId = '';

    const setNewsName = async name => { //возвращает старое название
        const areas = await driver.findElements(By.css('article > header > textArea'));
        const originalName = await areas[1].getText();
        await areas[1].clear();
        await areas[1].sendKeys(name);
        await driver.findElement(By.css('article > .znakwrap > .checkNAU')).click();
        await driver.wait(until.elementLocated(By.css('div.allError > p.newload')), 2000);
        return originalName;
    }

    before(async () => {
        await driver.get('http://ivolga46.ru/novo.php');
    });

    it('admin login and change news', async () => {
        await login(driver, config.adminLogin, config.adminPassword);
        await driver.get('http://ivolga46.ru/novo.php');
        changedNewsName = 'test ' + (new TextDecoder()).decode(new Uint8Array(getUniqueRandomNumbers(65, 90, 4)));
        originalNewsName = await setNewsName(changedNewsName);
    });
    
    it('check changes from new unlogged window', async () => {
        adminWindowId = await driver.getWindowHandle();
        await driver.switchTo().newWindow('window');
        userWindowId = await driver.getWindowHandle();
        await driver.get('http://ivolga46.ru/404notfound');
        await driver.manage().deleteAllCookies();
        await driver.get('http://ivolga46.ru/novo.php');
        driver.wait(until.elementLocated(By.css('article > header > h1')), 1000);
        const newsNameFromUser = await driver.findElement(By.css('article > header > h1')).getText();
        assert.equal(changedNewsName, newsNameFromUser.trim(), 'Нет изменения контента на стороне пользователя');
    });

    after(async () => {
        await driver.switchTo().window(adminWindowId);
        await setNewsName(originalNewsName);
        await driver.close();
        await driver.switchTo().window(userWindowId);
    });
});

describe('ui adaptive', async () => {
    before(async () => {
        await driver.get('http://ivolga46.ru/produkts.php');
    });

    it('chech small size', async () => {
        await driver.manage().window().setRect({width: 600, height: 800});
        const menuItemImgs = await driver.findElements(By.css('.pMenu > a > img'));
        assert.isNotEmpty(menuItemImgs);
    });

    it('chech big size', async () => {
        await driver.manage().window().setRect({width: 1400, height: 900});
        await driver.sleep(500); // ожидаем реакции скрипта на изменение размера
        const menuItemName = await driver.findElement(By.css('.pMenu > a')).getText();
        assert.isNotEmpty(menuItemName);
    });
});

describe('check save session after restart browser', async () => {
    let PHPSESSID = '';

    before(async () => {
        await driver.get('http://ivolga46.ru/produkts.php');
    });

    it('login', async function() {
        await login(driver, config.testUserLogin, config.testUserPassword);
        PHPSESSID = (await driver.manage().getCookie('PHPSESSID')).value;
    });
    
    it('reopen browser', async () => {
        await driver.quit();
        driver = await new Builder().forBrowser(Browser.CHROME).build();
        await driver.get('http://ivolga46.ru/404notfound');
        await driver.manage().addCookie({ name: 'PHPSESSID', value: PHPSESSID, sameSite: 'Strict' });
        await driver.get('http://ivolga46.ru');
        await driver.wait(until.elementLocated(By.id('LichBut')), 1000);
    });

    it('logout', async function() {
        await driver.findElement(By.css('#authblock input[name="exit"]')).click();
        await driver.wait(until.elementLocated(By.id('reg')), 1000);
    });
});

describe('check categories in products page', async () => {
    it('check', async () => {
        await driver.get('http://ivolga46.ru/produkts.php');
        let productCategories = await driver.findElements(By.css('.pMenu > a'));
        assert.isAbove(productCategories.length, 0, 'product categories must be greater then 0');
    });
});

describe('find and select weight product', async () => {
    const countToAdd = 2; //Количество добавляемых весовых товаров

    before(async () => {
        await driver.get('http://ivolga46.ru/produkts.php');
        await resetBasket(driver);
    });

    it(`select category ${config.weightCategory}`, async () => {
        await selectCategory(driver, config.weightCategory);
    });

    it('get weight products from api', async () => {
        //Запрос весового товара у api, т.к. соответствующих фильтров в интерфейсе на сайте нет
        const rawHttpData = await driver.executeScript(`return new Promise((resolve, reject) => $.post('cycprod.php', {filter: true}, resolve))`);
        const startIndex = rawHttpData.indexOf('<header>');
        assert.notEqual(startIndex, '-1', 'весового товара нет'); //Если header нет, значит весовой товар не найден, тест провести нельзя
        const endIndex = rawHttpData.indexOf('</header>');
        const productTitle = rawHttpData.slice(startIndex + 8, endIndex);
        const productElements = await searchProducts(driver, productTitle);
        assert.isAbove(productElements.length, 0, 'весовой товар не найден');

        const isWeightGood = await productElements[0].findElement(By.css('.salePrice')).getAttribute('ves');
        assert.equal(isWeightGood, '1', 'найден не весовой товар');

        await toggleMiniBasket(driver, true);
        const [countPrev, sumPrev] = await getBasketValues(driver);
        const productElement = await productElements[0].findElement(By.className('add'));
        const price = await productElement.getAttribute('price');
        
        for(let i = 0; i < countToAdd; i++) 
            await productElement.click();

        const [count, sum] = await getBasketValues(driver);

        assert.equal(count, countPrev + 1); //т.к. несколько единиц весового товара считается за 1шт
        assert.equal(sum, sumPrev + parseFloat(price) * countToAdd);
    });

    it('check weight change', async () => {
        await driver.findElement(By.id('zak')).click();
        await driver.wait(until.elementLocated(By.className('checkKorz')), 1000);
        const productElement = await driver.findElement(By.css('.Karts > footer'));
        const plusButton = await productElement.findElement(By.className('plus'));
        const minusButton = await productElement.findElement(By.className('minus'));
        const countSpan = await productElement.findElement(By.className('count'));
        const price = parseFloat(await productElement.findElement(By.className('Ves')).getText());
        let count, sum, countPrev, sumPrev;
        const getProductCardPrice = () => 
            productElement.findElement(By.className('allPrice')).getText().then(parseFloat);

        assert.equal(await countSpan.getText(), countToAdd, 'Количество товара в корзине не соответствует выбранному ранее');

        [countPrev, sumPrev] = await getBasketValues(driver);
        await plusButton.click();
        assert.equal(await countSpan.getText(), countToAdd + .1, 'шаг изменения(+) количества весового товара не соответствует 0.1');
        assert.equal(price * (countToAdd + .1), await getProductCardPrice(), 'Неверное изменение цены в карточке');
        [count, sum] = await getBasketValues(driver);
        assert.equal(sum, sumPrev + price * .1);
        assert.equal(countPrev, count, 'Количество весового товара не должно изменяться'); 

        [countPrev, sumPrev] = [count, sum]; //Текущее сделать предыдущим

        await minusButton.click(); 
        assert.equal(await countSpan.getText(), countToAdd, 'шаг изменения(-) количества весового товара не соответствует 0.1');
        assert.equal(price * countToAdd, await getProductCardPrice(), 'Неверное изменение цены в карточке');
        [count, sum] = await getBasketValues(driver);
        assert.equal(sum, sumPrev - price * .1);
        assert.equal(countPrev, count);

        for (let i = 0; i < countToAdd * 10; i++) 
            await minusButton.click();

        [count, sum] = await getBasketValues(driver);

        assert.equal(0, count);
        assert.equal(0, sum);    
    });
});

describe('find products', async () => {
    before(async () => {
        await driver.get('http://ivolga46.ru/produkts.php');
        await resetBasket(driver);
    });

    it(`select category`, async () => {
        await selectCategory(driver, getRandomInt(0, config.countOfCategories - 1));
    });

    it(`find product`, async () => {
        const productCardName = await driver.findElement(By.css('.Karts > header')).getText();
        const products = await searchProducts(driver, productCardName);
        const foundProductName = await products[0].findElement(By.css('header')).getText();
        assert.equal(foundProductName.includes(productCardName), true, `искомый продукт ${productCardName} не найден(найдено ${foundProductName})`);
    });
});

describe('make an order', async () => {
    let dateDelivery = new Date();
    dateDelivery.setMonth(dateDelivery.getMonth() + 1);

    const categoriesToTest = getUniqueRandomNumbers(0, config.countOfCategories - 1, 2); categoriesToTest.push(4)
    const basket = new class extends Map {
        getTotalCountAndSum() {
            return Array.from(this.values()).reduce((accum, {count, price, isWeightGood}) => {
                accum.sum += count * price;
                accum.count += isWeightGood ? 1 : count; //Весовой товар считается за единицу
                return accum;
            }, {sum: 0, count: 0});
        }
    }

    before(async () => {
        await driver.get('http://ivolga46.ru/produkts.php');
        await resetBasket(driver);
    });

    it('login', async () => {
        await login(driver, config.testUserLogin, config.testUserPassword);
        await driver.get('http://ivolga46.ru/produkts.php');
    });

    for (const categoryId of categoriesToTest) {
        it(`select category ${categoryId}`, async () => {
            await selectCategory(driver, categoryId);
        });

        it(`select products`, async () => {
            const productCards = await driver.findElements(By.className('Karts'));
            assert.isAbove(productCards.length, 0, 'count of products must be greater then 0'); 
            const countOfProductsToSelect = getRandomInt(1, productCards.length);
            const productIndexesToSelect = getUniqueRandomNumbers(0, productCards.length - 1, countOfProductsToSelect);
            
            for (const currentIndex of productIndexesToSelect) {
                const currentIndex = getRandomInt(0, productCards.length - 1);
                const productElementWrapper = productCards[currentIndex]; 
                const productElement = await productElementWrapper.findElement(By.className('add'));
                const isWeightGood = Boolean(await productElementWrapper.findElement(By.className('salePrice')).getAttribute('ves'));
                const productId = Number(await productElement.getAttribute('rel'));
                await toggleMiniBasket(driver, true);
                const [countPrev, sumPrev] = await getBasketValues(driver);
                const countToAdd = isWeightGood ? 3 : getRandomInt(1, 2); 
                //Для тестирования весового товара используем количество > 1
                //Так как несколько весовых товаров считаются за одну позицию
                
                const product = basket.get(productId) ?? ({
                    price: Number(await productElement.getAttribute('price')),
                    count: 0, 
                    isWeightGood
                });
                
                product.count += countToAdd; 
                
                await driver.actions().scroll(0, 0, 0, 0, productElement).perform();
                
                for(let i = 0; i < countToAdd; i++) await productElement.click();

                const [count, sum] = await getBasketValues(driver);

                assert.equal(count, countPrev + (isWeightGood || countToAdd)); 
                assert.equal(sum, sumPrev + product.price * countToAdd);

                basket.set(productId, product);
            }
        });
    }

    it(`check mini basket`, async () => {
        await toggleMiniBasket(driver, true);
        const [count, price] = await getBasketValues(driver);
        const basketTotal = basket.getTotalCountAndSum();
        assert.equal(basketTotal.sum, price, 'Рассчётная сумма не равна сумме в корзине');
        assert.equal(basketTotal.count, count, 'Рассчётное количество не равно количеству в корзине');
    });

    it(`delete product`, async () => {
        await driver.findElement(By.id('zak')).click();
        await driver.wait(until.elementLocated(By.className('checkKorz')), 1000);
        let count, sum, countPrev, sumPrev;

        let productElement = await driver.findElement(By.css('.Karts'));
        let countSpan = await productElement.findElement(By.className('count'));
        let totalPriceOfProduct = await productElement.findElement(By.className('infoCount')).getText();
        let isWeightGood = !+(await productElement.findElement(By.className('Ves')).getText());
        
        [countPrev, sumPrev] = await getBasketValues(driver);
        const productDel = await productElement.findElement(By.className('upRight'));
        let prodId = await productDel.getAttribute('rel');
        let prodCount = await countSpan.getText();
        productDel.click(); //удалили продукт из корзины
        driver.wait(until.stalenessOf(productElement), 2000);
        basket.delete(prodId);
        [count, sum] = await getBasketValues(driver);

        assert.equal(count, countPrev - (isWeightGood ? 1 : prodCount));
        assert.equal(sum, sumPrev - totalPriceOfProduct);
    });

    it(`make an order`, async () => {
        const dateString = `${dateDelivery.toLocaleDateString()}`;
        await driver.findElement(By.id('dost')).click();
        await driver.findElement(By.id('dateDost')).sendKeys(dateString, Key.TAB, dateDelivery.toLocaleTimeString().slice(0,5));
        await driver.findElement(By.id('zakaz')).click();
        await driver.wait(until.elementLocated(By.id('butHome')), 5000);
        const resultText = await driver.findElement(By.css('#load > h1')).getText();
        assert.equal(resultText, 'Заказ успешно оформлен!');
    });

    it(`check order on lk`, async () => {
        await driver.get('http://ivolga46.ru/lichka.php');
        const orders = await driver.findElements(By.css('.lichZakWrap'));
        const lastOrder = orders[orders.length - 1];
        const productCards = await lastOrder.findElements(By.css('.Karts'));
        const orderDateLis = await lastOrder.findElements(By.css('.LickZakInfo > li'));
        const dateText = await orderDateLis[3].getText();
        const dateDeliveryInOrder = new Date(dateText.slice(15));

        for (let card of productCards) {
            const prodId = await card.getAttribute('rel');
            const price = await card.findElement(By.className('salePrice')).getText();
            const count = parseFloat(await card.findElement(By.className('countPrice')).getText());
            const basketProductInfo = basket.get(+prodId);

            assert.equal(true, !!basketProductInfo, `Товар с id ${prodId} не был заказан пользователем`);
            assert.equal(basketProductInfo.count, count);
            assert.equal(basketProductInfo.price, parseFloat(price));
        }

        assert.equal(dateDeliveryInOrder.toLocaleString().slice(0,17), dateDelivery.toLocaleString().slice(0,17), 'Дата доставки в личном кабинете не совпадает с датой указанной при оформлении');
    });

    it(`delete order`, async () => {
        const orders = await driver.findElements(By.css('.lichZakWrap'));
        const lastOrder = orders[orders.length - 1];
        const delButton = await lastOrder.findElement(By.className('lichZakDel'));
        await driver.actions().scroll(0, 0, 0, 0, delButton).perform();
        await delButton.click();
        await driver.wait(until.alertIsPresent());
        let alert = await driver.switchTo().alert();
        await alert.accept();
    });
}); 