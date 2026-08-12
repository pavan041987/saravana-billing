const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || 'saravana-billing-secret-2024';

// ── CONNECT DB ────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ── SCHEMAS ───────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  createdAt: { type: Date, default: Date.now }
});

const BillSchema = new mongoose.Schema({
  billId: { type: String, unique: true },
  patient: String,
  age: String,
  gender: { type: String, default: 'Male' },
  phone: String,
  location: String,
  branch: String,
  type: String,
  status: { type: String, default: 'Pending' },
  date: String,
  total: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  charges: [{ name: String, cat: String, amt: Number, qty: Number }],
  meds: [{ name: String, price: Number, unit: String, qty: Number }],
  discount: { type: Number, default: 0 },
  admitDate: String,
  dischargeDate: String,
  referredBy: String,
  payMode: { type: String, default: 'Cash' },
  notes: String,
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const MedSchema = new mongoose.Schema({
  medId: { type: Number, unique: true },
  name: String,
  brand: String,
  category: String,
  price: Number,
  unit: String,
  expiry: String,
  updatedAt: { type: Date, default: Date.now }
});

const CounterSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  value: { type: Number, default: 0 }
});

const ConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const User    = mongoose.model('BillingUser', UserSchema);
const Bill    = mongoose.model('BillingBill', BillSchema);
const Med     = mongoose.model('BillingMed', MedSchema);
const Counter = mongoose.model('BillingCounter', CounterSchema);
const Config  = mongoose.model('BillingConfig', ConfigSchema);

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI, dbName: 'saravana_billing' }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH MIDDLEWARE ───────────────────────────────────────────
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Not logged in' });
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  res.status(403).json({ error: 'Admin only' });
}

// ── SEED DEFAULT DATA ─────────────────────────────────────────
async function seedIfEmpty() {
  // Default admin
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const hash = await bcrypt.hash('saravana2024', 10);
    await User.create({ username: 'admin', password: hash, role: 'admin' });
    await User.create({ username: 'staff', password: await bcrypt.hash('staff123', 10), role: 'staff' });
    console.log('Default users created: admin/saravana2024, staff/staff123');
  }

  // Counter
  const ctr = await Counter.findOne({ name: 'billCounter' });
  if (!ctr) await Counter.create({ name: 'billCounter', value: 0 });

  // Default config
  const cfg = await Config.findOne({ key: 'hospitalConfig' });
  if (!cfg) {
    await Config.create({ key: 'hospitalConfig', value: {
      name: 'Saravana Super Speciality Hospital',
      branches: ['Guntur', 'Satenapalli'],
      addr1: '06/15 Brodipet, Guntur - 522 002, Andhra Pradesh',
      addr2: 'Old Vijaya Bank Building, Satenapalli - 522 403, Andhra Pradesh',
      phone: '7386542191 / 7386542192',
      email: 'saravana.hospital@gmail.com',
      doctor: 'Dr. Pramod — MD Gen Med, DM Neurology',
      prefix: 'SRVN',
      regNo: 'MCI/REG/2018/04521'
    }});
  }

  // Default medicines
  const medCount = await Med.countDocuments();
  if (medCount === 0) {
    const defaultMeds = [
      {medId:1,name:'Paracetamol 500mg',brand:'Calpol',category:'Analgesic',price:2.5,unit:'Tab',expiry:'2026-06'},
      {medId:2,name:'Amoxicillin 500mg',brand:'Mox',category:'Antibiotic',price:8,unit:'Cap',expiry:'2025-12'},
      {medId:3,name:'Metformin 500mg',brand:'Glucophage',category:'Antidiabetic',price:3,unit:'Tab',expiry:'2026-09'},
      {medId:4,name:'Amlodipine 5mg',brand:'Amlovas',category:'Antihypertensive',price:4.5,unit:'Tab',expiry:'2026-03'},
      {medId:5,name:'Omeprazole 20mg',brand:'Omez',category:'Antacid',price:5,unit:'Cap',expiry:'2026-11'},
      {medId:6,name:'Atorvastatin 10mg',brand:'Atorva',category:'Lipid Lowering',price:6,unit:'Tab',expiry:'2027-01'},
      {medId:7,name:'Pantoprazole 40mg',brand:'Pan 40',category:'Antacid',price:4,unit:'Tab',expiry:'2026-08'},
      {medId:8,name:'Normal Saline 500ml',brand:'NS',category:'IV Fluid',price:45,unit:'Bottle',expiry:'2026-05'},
      {medId:9,name:'Dextrose 5%',brand:'DNS',category:'IV Fluid',price:48,unit:'Bottle',expiry:'2026-04'},
      {medId:10,name:'Aspirin 75mg',brand:'Ecosprin',category:'Antiplatelet',price:1.5,unit:'Tab',expiry:'2027-02'},
      {medId:11,name:'Clopidogrel 75mg',brand:'Clopilet',category:'Antiplatelet',price:7,unit:'Tab',expiry:'2026-12'},
      {medId:12,name:'Ciprofloxacin 500mg',brand:'Ciplox',category:'Antibiotic',price:9,unit:'Tab',expiry:'2026-10'},
      {medId:13,name:'Cetirizine 10mg',brand:'CTZ',category:'Antiallergic',price:2,unit:'Tab',expiry:'2027-03'},
      {medId:14,name:'Dolo 650mg',brand:'Dolo',category:'Analgesic',price:3,unit:'Tab',expiry:'2026-07'},
      {medId:15,name:'Azithromycin 500mg',brand:'Azee',category:'Antibiotic',price:35,unit:'Tab',expiry:'2026-06'},
      {medId:16,name:'Metoprolol 25mg',brand:'Met XL',category:'Antihypertensive',price:4,unit:'Tab',expiry:'2026-09'},
      {medId:17,name:'Losartan 50mg',brand:'Losar',category:'Antihypertensive',price:5,unit:'Tab',expiry:'2026-11'},
      {medId:18,name:'Diclofenac 50mg',brand:'Voveran',category:'Analgesic',price:3.5,unit:'Tab',expiry:'2026-08'},
      {medId:19,name:'Ranitidine 150mg',brand:'Aciloc',category:'Antacid',price:3,unit:'Tab',expiry:'2025-11'},
      {medId:20,name:'Insulin Glargine 100IU',brand:'Lantus',category:'Antidiabetic',price:850,unit:'Vial',expiry:'2025-09'},
    ];
    await Med.insertMany(defaultMeds);
    await Counter.findOneAndUpdate({ name: 'medCounter' }, { value: 20 }, { upsert: true });
    console.log('Default medicines seeded');
  }
}

// ── AUTH ROUTES ───────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) return res.json({ success: false, error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, error: 'Invalid credentials' });
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.json({ success: true, role: user.role, username: user.username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, username: req.session.username, role: req.session.role });
});

// ── BILLS ─────────────────────────────────────────────────────
app.get('/api/bills', requireLogin, async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.json(bills);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bills', requireLogin, async (req, res) => {
  try {
    const ctr = await Counter.findOneAndUpdate(
      { name: 'billCounter' }, { $inc: { value: 1 } }, { new: true, upsert: true }
    );
    const cfg = await Config.findOne({ key: 'hospitalConfig' });
    const prefix = cfg?.value?.prefix || 'SRVN';
    const billId = `${prefix}-${String(ctr.value).padStart(3, '0')}`;
    const today = req.body.date || new Date().toLocaleDateString('en-IN');
    const bill = await Bill.create({ ...req.body, billId, date: today, createdBy: req.session.username });
    res.json(bill);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/bills/:id', requireLogin, async (req, res) => {
  try {
    const bill = await Bill.findOneAndUpdate(
      { billId: req.params.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json(bill);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/bills/:id', requireLogin, requireAdmin, async (req, res) => {
  try {
    await Bill.findOneAndDelete({ billId: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MEDICINES ─────────────────────────────────────────────────
app.get('/api/meds', requireLogin, async (req, res) => {
  try {
    const meds = await Med.find().sort({ name: 1 });
    res.json(meds);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/meds', requireLogin, async (req, res) => {
  try {
    const ctr = await Counter.findOneAndUpdate(
      { name: 'medCounter' }, { $inc: { value: 1 } }, { new: true, upsert: true }
    );
    const med = await Med.create({ ...req.body, medId: ctr.value });
    res.json(med);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/meds/:id', requireLogin, async (req, res) => {
  try {
    const med = await Med.findOneAndUpdate(
      { medId: parseInt(req.params.id) },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json(med);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/meds/:id', requireLogin, requireAdmin, async (req, res) => {
  try {
    await Med.findOneAndDelete({ medId: parseInt(req.params.id) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CONFIG ────────────────────────────────────────────────────
app.get('/api/config', requireLogin, async (req, res) => {
  try {
    const cfg = await Config.findOne({ key: 'hospitalConfig' });
    res.json(cfg?.value || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/config', requireLogin, requireAdmin, async (req, res) => {
  try {
    await Config.findOneAndUpdate(
      { key: 'hospitalConfig' }, { value: req.body }, { upsert: true }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── USERS (admin only) ────────────────────────────────────────
app.get('/api/users', requireLogin, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', requireLogin, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username: username.toLowerCase(), password: hash, role });
    res.json({ success: true, username: user.username, role: user.role });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:username', requireLogin, requireAdmin, async (req, res) => {
  try {
    if (req.params.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
    await User.findOneAndDelete({ username: req.params.username });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:username/password', requireLogin, async (req, res) => {
  try {
    if (req.session.role !== 'admin' && req.session.username !== req.params.username)
      return res.status(403).json({ error: 'Forbidden' });
    const hash = await bcrypt.hash(req.body.password, 10);
    await User.findOneAndUpdate({ username: req.params.username }, { password: hash });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STATS ─────────────────────────────────────────────────────
app.get('/api/stats', requireLogin, async (req, res) => {
  try {
    const bills = await Bill.find();
    const today = new Date().toLocaleDateString('en-IN');
    res.json({
      total: bills.length,
      todayCount: bills.filter(b => b.date === today).length,
      collected: bills.reduce((s, b) => s + b.paid, 0),
      pending: bills.reduce((s, b) => s + (b.total - b.paid), 0),
      activeIP: bills.filter(b => b.type === 'Inpatient' && b.status === 'Active').length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Saravana Billing running on port ${PORT}`);
  await seedIfEmpty();
});
