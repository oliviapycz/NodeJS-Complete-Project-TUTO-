const mongoose = require('mongoose');
// we can call the model via mongoose cause we have declared it
// globally in start.js
//here we're calling the model Store with a capital S that refers to the model in Store.js
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if (isPhoto) {
            next(null, true);
        } else {
            next({message: 'That filetype isn\'t allowed'})
        }
    }
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
    // check if there is no new file to resize
    if ( !req.file) {
        next(); // skip to the next middleware
        return;
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`; 
    // now we resize
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO); // width and height
    await photo.write(`./public/uploads/${req.body.photo}`);
    // once we have written the photo to our filesystem, keep going
    next();
}


exports.homePage = (req, res) => {
    console.log(req.name);
    res.render('index');
};

exports.getStores = async (req, res) => {
    const page = req.params.page || 1;
    const limit = 6;
    const skip = (page * limit) - limit;
    //  1.Query the id for a list of all stores
    const storesPromise = Store
        .find()
        .skip(skip)
        .limit(limit)
        .sort({ created: 'desc' })
    const countPromise = Store.count();
    const [stores, count] = await Promise.all([storesPromise, countPromise]);
    const pages = Math.ceil(count / limit);
    if (!stores.length && skip) {
        req.flash('info', `You asked for page ${page} but that doesn't exist. So I put you on page ${pages}`);
        res.redirect(`/sores/page/${pages}`);
    }
    res.render('stores', { title: 'Stores', stores, count, page, pages });
};

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
    if (!store) return next();
    res.render('store', { title: store.name, store });
};

exports.addStore = (req, res) => {
    res.render('editStore', {
        title: 'Add Store'
    });
};

exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
    req.flash('success', `Succesfully Created ${store.name}.`);
    res.redirect(`/store/${store.slug}`);
};

const confirmOwner = (store, user) => {
    if (!store.author.equals(user._id)) {
        throw Error('You must own a store in order to edit it');
    }
};

exports.editStore = async (req, res) => {
    // 1. Find the store given the ID
    const store = await Store.findOne({ _id: req.params.id });

    // 2. Confirm they are the owner of the store
    confirmOwner(store, req.user);
    // 3. Render out th edit form so the user can update their store
    res.render('editStore', {
        title: `Edit ${store.name}`,
        store
    })
};

exports.updateStore = async (req, res) => {
    // set the location data to be a point
    req.body.location.type = 'Point';
    // find and update the store
    const store = await Store.findOneAndUpdate( // take 3 parameters
        { _id: req.params.id}, // the query
        req.body, // the data
        { // the options
            new: true, // return the new store instead of the old one
            runValidators: true // force our model to run the required validators
        }).exec(); // by default some of the query won't run exec make sure they all run
        req.flash('success', `Succewsfully updated <strong>${store.name}</strong>. <a href="/store/${store.slug}">View Store</a>`)
        res.redirect(`/stores/${store._id}/edit`);
        //redirect them the store and tell them it worked
};

exports.getStoresByTag = async (req, res) => {
    const tag = req.params.tag;
    const tagsPromise = await Store.getTagsList();
    const tagQuery = tag || { $exists: true }
    const storesPromise = Store.find({ tags: tagQuery });
    // Promise.all here await for all pending promises
    // const result = await Promise.all([tagsPromise, storesPromise]);
    // we can destructure result immediatly to not do:
    // tags = result[0] and stores = result[1]
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
    res.render('tag', { tags, title: 'Tags', tag, stores});
};

exports.searchStores = async (req, res) => {
    const stores = await Store.find({
        $text: { //$text is from mongodb for indexes
            $search: req.query.q   
        }
    }, {
        score: { $meta: 'textScore' } //from mongo give a score (add a field called score) depending on the number of time the query appears
    })
    .sort({
        score: { $meta: 'textScore' }
    })
    .limit(5);
    res.json(stores);
};

exports.mapStores = async (req, res) => {
    const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
    const q = {
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates
                },
                $maxDistance: 10000
            }
        }
    }

    const stores = await Store.find(q).select('slug name description location photo').limit(10);
    // select able you to choose what to get here it's the data we want we use -photo or -location for something we dont want
    // limit give only the 10 first results
    res.json(stores);
};

exports.mapPage = (req, res) => {
    res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map(obj => obj.toString());
    const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { [operator]: { hearts: req.params.id }},
        { new: true }
    )
    res.json(user);
};

exports.getHearts = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }
    });
    res.render('stores', { title: 'Hearted Stores', stores })
};

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    res.render('topStores', { stores, title: ' ★ Top Stores' })
};