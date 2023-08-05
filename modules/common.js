const { getRandomInt } = require('./utils.js');
const { By, until } = require('selenium-webdriver');

async function login(driver, login, password) {
    await driver.findElement(By.id('vhod')).click();
    const loginButton = driver.findElement(By.id('log_submit'));
    await driver.wait(until.elementIsVisible(loginButton), 1000);
    await driver.findElement(By.css('#block-vhod input[name="v_login"]')).sendKeys(login);
    await driver.findElement(By.css('#block-vhod input[name="v_pass"]')).sendKeys(password);
    await loginButton.click();
    await driver.wait(until.elementLocated(By.css('#authblock > form > input[name="exit"]')), 1000);
}

function getBasketValues(driver) {
    return Promise.all(
        ['count', 'price'].map(async elemId => parseFloat(
            await driver.findElement(By.id(elemId)).getText()
        ))
    );
}

async function searchProducts(driver, productTitle) {
    const productCard = await driver.findElement(By.className('Karts')); //Ждём загрузки первого элемента
    await driver.findElement(By.id('srchBut')).click(); // Открываем поле поиска
    const searchField = await driver.findElement(By.id('srchInp'));
    await searchField.clear();
    await driver.actions().click(searchField).sendKeys(productTitle).perform(); //Вводим строку поиска
    await driver.findElement(By.id('srchBut')).click(); //Ищем
    await driver.wait(until.stalenessOf(productCard), 1000); //Ждём исчезновения карточки товара
    
    try {
        await driver.wait(until.elementLocated(By.className('Karts')), 1000); //Ждём появления найденных
        const searchedCard = await driver.findElement(By.css('.Karts'));
        await driver.wait(until.elementIsVisible(searchedCard), 1000);
        const cards = await driver.findElements(By.css('.Karts'))
        return cards;

        } catch (e) { // Вернуть пустой массив если ничего не найдено
            if (e.name === 'TimeoutError') return [];
            else throw e;
        }
}

async function resetBasket(driver) {
    const resetButton = await driver.findElement(By.id('res'));
    await toggleMiniBasket(driver, true);
    await resetButton.click();
}

async function selectCategory(driver, id) {
    await toggleMiniBasket(driver, false); //свернуть корзину чтобы не мешала кликать
    await driver.wait(until.elementLocated(By.className('Karts')), 1000); //Ждём появления карточек товара
    const productCard = await driver.findElement(By.className('Karts')); //Ждём загрузки первого элемента
    await (await getCategoryElementById(driver, id)).click(); //Выбрали категорию. Предыдущие карточки товара начали удаляться
    await driver.wait(until.stalenessOf(productCard), 1000); //Ждём исчезновения карточки товара 
    await driver.wait(until.elementLocated(By.className('Karts')), 1000); //Ждём появления карточек товара новой выбранной категории
}

async function toggleMiniBasket(driver, open) {
    const resetButton = await driver.findElement(By.id('res'));
    const opened = await resetButton.isDisplayed();

    if (opened ^ open) {
        await driver.findElement(By.id(open ? 'down1' : 'up1')).click();
        await driver.wait(until[`elementIs${open ? '' : 'Not'}Visible`](resetButton), 1000);
    }
}

async function getCategoryElementById(driver, id) {
    if (id === '?' || !isNaN(+id)) {
        let productCategories = await driver.findElements(By.css('.pMenu > a'));
        if (id === '?') id = getRandomInt(0, productCategories.length - 1);
        return productCategories[id];
        //можно было бы так, только нам неизвестно сколько категорий By.css(`:nth-child(2)`)
    } else {
        return driver.findElement(By.id(id));
    }
} 

module.exports = {
    login, 
    getBasketValues, 
    searchProducts, 
    resetBasket, 
    selectCategory, 
    toggleMiniBasket, 
    getCategoryElementById
}