require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Session Middleware ---
app.use(session({
  secret: 'your-secret-key', // Replace with a secure secret in production
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Passport Serialization ---
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// --- OAuth2 Strategy Setup ---
passport.use(new OAuth2Strategy({
    authorizationURL: process.env.JOBBER_AUTHORIZATION_URL, // e.g., https://api.getjobber.com/api/oauth/authorize
    tokenURL: process.env.JOBBER_TOKEN_URL,                 // e.g., https://api.getjobber.com/api/oauth/token
    clientID: process.env.JOBBER_CLIENT_ID,
    clientSecret: process.env.JOBBER_CLIENT_SECRET,
    callbackURL: process.env.JOBBER_CALLBACK_URL,
    scope: process.env.JOBBER_SCOPE, // e.g., "read:visits"
    state: true
  },
  (accessToken, refreshToken, profile, done) => {
    // In production, store tokens securely.
    const user = { accessToken, refreshToken };
    return done(null, user);
  }
));

// --- OAuth Routes ---
app.get('/auth/jobber', passport.authenticate('oauth2'));

app.get('/auth/jobber/callback', 
  passport.authenticate('oauth2', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication; redirect to main app page.
    res.redirect('/');
  }
);

// --- ensureAuthenticated Middleware ---
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.redirect('/auth/jobber');
}

// --- API Endpoint to Check Authentication ---
app.get('/api/authenticated', ensureAuthenticated, (req, res) => {
  res.json({ authenticated: true });
});

// --- API Endpoint to Fetch Visits ---
// (Defined before serving static files)
app.get('/api/visits', ensureAuthenticated, async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  console.log("Jobber API Version:", process.env.JOBBER_API_VERSION);

  const graphQLQuery = {
    query: `
      query VisitsByDateRange($start: ISO8601DateTime!, $end: ISO8601DateTime!) {
        visits(
          filter: {
            startAt: {
              after: $start,
              before: $end
            }
          }
          sort: {
            key: START_AT,
            direction: ASCENDING
          }
          timezone: "America/Los_Angeles"
        ) {
          edges {
            node {
              title
              startAt
              job {
                jobberWebUri
                total
                customFields {
                  ... on CustomFieldText {
                    label
                    valueText
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      start: startDate, // Must be a valid ISO8601 string
      end: endDate
    }
  };

  try {
    const response = await axios.post(process.env.JOBBER_API_URL, graphQLQuery, {
      headers: {
        'Authorization': `Bearer ${req.user.accessToken}`,
        'Content-Type': 'application/json',
        'X-JOBBER-GRAPHQL-VERSION': process.env.JOBBER_API_VERSION
      }
    });
    res.json(response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error fetching visits:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else {
      console.error('Error fetching visits:', error.message);
    }
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

// --- Serve Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});