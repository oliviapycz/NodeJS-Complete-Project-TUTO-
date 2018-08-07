const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');

exports.loginForm = (req, res) => {
    res.render('login', { title: 'login' });
};

exports.registerForm = (req, res) => {
    res.render('register', { title: 'register' });
};

exports.validateRegister = (req, res, next) => {
    //  come from app.js the expressValidator plugin
    req.sanitizeBody('name');
    req.checkBody('name', 'You must supply a name').notEmpty();
    req.checkBody('email', 'That email is not valid').isEmail();
    req.sanitizeBody('email').normalizeEmail({ 
        remove_dots: false,
        remove_extension: false,
        gmail_remove_subaddress: false
    });
    req.checkBody('password', 'You must supply a password').notEmpty();
    req.checkBody('password-confirm', 'You must confirm your password').notEmpty();
    req.checkBody('password-confirm', 'Your passwords must be the same').equals(req.body.password);
    
    const errors = req.validationErrors();
    if (errors) {
        req.flash('error', errors.map(err => err.msg));
        res.render('register', { title: 'Register', body: req.body, flashes: req.flash() });
        return; // stop the fn from running
    }
    next(); // there were no errors
};

exports.register = async (req, res, next) => {
    const user = new User({ email: req.body.email, name: req.body.name });
    // User.register(user, req.body.pasword, function(err,  user) {
        //   
    // });
    // the method register use callback
    // with the plugin promisify we can turn it to a promise
    const register = promisify(User.register, User);
    await register(user, req.body.password);
    next(); // pass to authController.login
    console.log(req.body.pasword);
    
};

exports.account = (req, res) => {
    res.render('account', { title: 'Edit Your Account' });
};

exports.updateAccount = async (req, res) => {
    const updates = {
        name: req.body.name,
        email: req.body.email
    };

    const user = await User.findOneAndUpdate(
        { _id: req.user._id },
        { $set: updates },
        { new: true, runValidators: true, context: 'query' }
    );
    req.flash('success', 'Updated the profile');
    // redirect to the url where we came from
    res.redirect('back');
};
