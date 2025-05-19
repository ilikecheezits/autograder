/**
 * Authentication middleware for protecting routes
 */

/**
 * Checks if user is logged in
 */
function checkLoggedIn(req, res, next) {
    if (req.session && req.session.loggedin) {
        next();
    } else {
        res.redirect('/login');
    }
}

/**
 * Checks if user is an admin
 */
function checkAdmin(req, res, next) {
    if (req.session && req.session.loggedin && req.session.admin) {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized' });
    }
}

/**
 * Validates CSRF token
 */
function validateCSRF(req, res, next) {
    const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
    if (token && token === req.session.csrfToken) {
        next();
    } else {
        res.status(403).json({ error: 'Invalid CSRF token' });
    }
}

/**
 * Generates a CSRF token
 */
function generateCSRFToken(req, res, next) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
    }
    // Make token available to views
    res.locals.csrfToken = req.session.csrfToken;
    next();
}

module.exports = {
    checkLoggedIn,
    checkAdmin,
    validateCSRF,
    generateCSRFToken
}; 