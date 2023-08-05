function getUniqueRandomNumbers(min, max, length) {
    if (max - min + 1 < length) throw Error('Невозможно сгенерировать уникальные числа в заданном диапазоне: слишком малая длина массива');
    let numbers = [];
    for (let i = 0; i < length; i++) {
        let number = getRandomInt(min, max);
        for(; numbers.includes(number); number = getRandomInt(min, max)) {}
        numbers.push(number);
    }
    return numbers;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { getUniqueRandomNumbers, getRandomInt }