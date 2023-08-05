const nodeMailer = require('nodemailer');

async function sendMail(html, {service, addressees, host, port, login, password}) {
    if (!login) {
        let testEmailAccount = await nodeMailer.createTestAccount();  
        login = testEmailAccount.user;
        password = testEmailAccount.password;  
    }

    const transporter = nodeMailer.createTransport({
        service,
        host, 
        port, 
        secure: true, 
        auth: {
            user: login,
            pass: password
        }
    });

    return transporter.sendMail({
        from: login,
        to: addressees.join(', '),
        subject: 'Отчёт о результатах автоматизированного теста вебсайта',
        text: '',
        html
    });
}

function createMail(testResultTags) {
    return ` <!DOCTYPE html><html>
    <head><title>Отчёт о результатах автоматизированного теста вебсайта</title></head>
    <body>
    <h1>Отчёт о результатах автоматизированного теста вебсайта</h1>
    ${testResultTags}
    </body>
    </html>`;
}

//Рекурсивно создаёт html ul дерево согласно результатам тестов
function createResultList(mochaTest, testErrorsImages) {
    let htmlLi = '';

    //внутри it 
    if (mochaTest.state) { 
        if (mochaTest.state === 'passed') {
            htmlLi += `<li>✔ ${mochaTest.title}</li>`;
        } else {
            htmlLi += `<li>❌ ${mochaTest.title}`;
            htmlLi += `<img style="width: 40%; width: 40%; display: block;" src="data:image/gif;base64,${testErrorsImages.get(mochaTest)}"><br>`; 
            htmlLi += mochaTest.err.message
            htmlLi += '</li>';
        }
        return htmlLi;
    } 

    //внутри describe
    if (mochaTest?.tests?.length > 0) { 
        if (mochaTest.title) htmlLi += `<li>${mochaTest.title}</li>`
        htmlLi += mochaTest.tests.map(test => createResultList(test, testErrorsImages)).join('');
    } 

    if (mochaTest?.suites?.length > 0) 
        htmlLi += mochaTest.suites.map(test => createResultList(test, testErrorsImages)).join('');
    
    return `<ul style="list-style-type:none">${htmlLi}</ul>`;
}

module.exports = {
    sendMail, 
    createMail,
    createResultList
}