var express = require('express');
var router = express.Router();

var firebase = require('firebase');
var admin = require("firebase-admin");
var certi = require("./acua.json");
admin.initializeApp({
    credential: admin.credential.cert(certi),
    databaseURL: "https://acua-a3c6b.firebaseio.com"
});

var stripe = require('stripe')(process.env.STRIPE_SECURITY_KEY);

router.get('/', function(req, res, next) {
    let orderId = req.query.orderId || '';
    let orderName = req.query.orderName || '';
    let price = req.query.price || 0.00;
    res.render('payment', { 'orderId': orderId, 'orderName':orderName, 'price': price });
});

router.get('/cancel', function(req, res, next) {
    res.render('payment-result', {title: 'Payment', content:'You cancelled payment'})
});

router.get('/return', function(req, res, next) {
    let orderId = req.query.orderId;
    if (orderId) {
        console.log('orderId : ', orderId)
        firebase.database().ref('Orders').child(orderId).update({'payStatus': 'PAID'});
    }
    res.render('payment-result', {title: 'Payment', content:'Payment Successful'})
});

router.post('/notify', function(req, res, next) {
    // let orderId = req.query.orderId || '';
    // if (orderId) {
    //     firebase.database().ref('Orders').child(orderId).child('payStatus').update('PAID');
    // }
    console.log('notify : ', req);
    res.status(200).send('success');
    res.end();
});


// ----------- Verify Payment Method for Ad hoc ------------- //
router.get('/verify', function(req, res, next){
    let userId = req.query.userId
    res.render('payment-verify', {userId: userId})
});

router.get('/verify_cancel', function(req, res, next) {
    res.render('payment-result', {title: 'Payment Verification', content:'You cancelled payment verification'})
});

router.get('/verify_return', function(req, res, next) {
    let userId = req.query.userId;
    if (userId) {
        console.log('userId : ', userId)
    }
    res.render('payment-result', {title: 'Payment Verification', content:'Payment Successful'})
});

router.post('/verify_notify', function(req, res, next) {

    const payment_status = req.body.payment_status; // 'COMPLETE'
    const userId = req.body.custom_str1;
    const token = req.body.token;
    const signature = req.body.signature;

    if (userId != null && token != null && payment_status == "COMPLETE") {
        console.log('userId : ', userId);
        console.log('token : ', token);
        console.log('signature : ', signature);
        admin.database().ref('PFTokens').child(userId).update({'token': token, 'signature': signature});
        admin.database().ref('Users').child(userId).update({'cardStatus': 1, 'cardToken':token});
    }

    res.status(200).send('success');
    res.end();
});

///----------------Stripe------------------------------///
function createCharge(charge) {

    return new Promise((resolve, reject) => {

        stripe.charges.create(charge, (err, res) => {

            if (err) return reject(err);
            //create transaction
            return resolve(res);
            
        });
    });
}

router.post('/charge', (req, res, next) => {

    const phoneNumber = req.body.phoneNumber;
    const serviceType = req.body.serviceType;
    const stripeToken = req.body.stripeToken;
    const serviceCost = req.body.serviceCost;
    const currencyUnit = req.body.currencyUnit;

    console.log('phoneNumber : ' + phoneNumber);

    stripe.customers.create({
        description: serviceType,
        email: phoneNumber,
        source: stripeToken
      }, function(error, customer) {
        if (customer) {
            console.log('customerId: ', customer.id);
            const charge = {
                'amount': serviceCost,
                'currency': currencyUnit==null?'zar':currencyUnit,
                'customer': customer.id
            };
            createCharge(charge).then((res1) => {
                console.log(res1);
                res.status(200).send(res1);
            }).catch((err) => {
                console.log(err);
                res.status(402).send(err);
            });  
        }else if (error) {
            res.status(402).send(error);
        }
      });

});

/**
 * Retrieve the customer object for the currently logged in user
 */
router.get('/customer', (req, res, next) => {

    var customerId = req.body.customerId;

    stripe.customers.retrieve(customerId, (err, customer) => {
        if (err) {

            res.status(402).send('Error retrieving customer.');
        }else {
            res.json(customer);
        }
    });
});

/**
 * Attach a new payment source to the customer for the currently logged in user
 */

router.post('/customer/sources', (req, res, next) => {
    var customerId = req.body.customerId;

    stripe.customers.createSource(customerId, {
        source: req.body.source
    }, (err, source) => {
        if (err) {
            res.status(402).send('Error attaching source.');
        }else {
            res.status(200).end();
        }
    });
});

/**
 * Select a new default payment source on the customer for the currently logged in user
 */

router.post('/customer/default_source', (req, res) => {
    var customerId = req.body.customerId;
    stripe.customers.update(customerId, {
        default_source: req.body.defaultSource
    }, (err, customer) => {
        if (err) {
            res.status(402).send('Error setting default source');
        } else {
            res.status(200).end();
        }
    })
});

module.exports = router;

