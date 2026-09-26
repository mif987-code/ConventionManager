import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import { PoolClient } from 'pg';
import { pool } from '../config/db';
import * as paymentService from '../services/paymentService';
import * as packageService from '../services/packageService';
import { enqueueGoogleSheetsSync } from '../services/backgroundJobService';
import { withTransaction } from '../utils/db';

const router = Router();

router.get('/merchandise-images/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query('SELECT content_type, data FROM merchandise_images WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found' });
    res.type(result.rows[0].content_type).send(result.rows[0].data);
  } catch (err) {
    next(err);
  }
});

// Cap registrations per IP to blunt scripted signup floods.
const registrationLimiter = rateLimit({
  windowMs: parseInt(process.env.REGISTRATION_RATE_WINDOW_MS || String(15 * 60 * 1000), 10),
  max: parseInt(process.env.REGISTRATION_RATE_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas inscripciones. Inténtalo de nuevo más tarde.' },
});

// Verifies a Google reCAPTCHA v2 token server-side. If RECAPTCHA_SECRET_KEY
// isn't set, verification is skipped entirely (useful for local dev before
// keys are configured) so this never blocks the app from running.
async function verifyRecaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // not configured — skip
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: token });
    const { data } = await axios.post('https://www.google.com/recaptcha/api/siteverify', params, {
      timeout: parseInt(process.env.RECAPTCHA_TIMEOUT_MS || '8000', 10),
    });
    return Boolean(data.success);
  } catch (err) {
    console.error('[Recaptcha] Verification request failed:', (err as Error).message);
    return false;
  }
}

// Letters (any language), spaces, apostrophes, hyphens, and periods only — no
// digits or symbols. Blocks junk/script-injection-style input in name fields
// (note: this is a data-quality guard, not a SQL-injection fix — all queries
// here already use parameterized values, so injection was never possible).
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]{0,49}$/u;

class RegistrationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function ageOnDate(dobValue: string, dateValue: string): number | null {
  const dobMatch = String(dobValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dateMatch = String(dateValue || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dobMatch || !dateMatch) return null;
  const [, birthYear, birthMonth, birthDay] = dobMatch.map(Number);
  const [, year, month, day] = dateMatch.map(Number);
  const dob = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));
  if (dob.getUTCFullYear() !== birthYear || dob.getUTCMonth() !== birthMonth - 1 || dob.getUTCDate() !== birthDay) return null;
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age--;
  return age;
}

async function preregisterParticipant(body: any, client: PoolClient) {
    const { name, last_name, email, password, age, dob, attendance_dates, package_id, packages: packagesInput, event_prereg_ids } = body;

    if (!name || !last_name || !email || !password) {
      throw new RegistrationError('El nombre, los apellidos, el correo y la contraseña son obligatorios');
    }
    if (typeof name !== 'string' || !NAME_PATTERN.test(name.trim())) {
      throw new RegistrationError('El nombre solo puede contener letras, espacios, guiones y apóstrofes');
    }
    if (typeof last_name !== 'string' || !NAME_PATTERN.test(last_name.trim())) {
      throw new RegistrationError('Los apellidos solo pueden contener letras, espacios, guiones y apóstrofes');
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new RegistrationError('La contraseña debe tener al menos 8 caracteres');
    }

    // Normalize package selection: support both the legacy single `package_id`
    // and the new `packages: [{ package_id, quantity }]` multi-select format.
    const selectedPackages: Array<{ package_id: number; quantity: number }> = Array.isArray(packagesInput) && packagesInput.length > 0
      ? packagesInput
          .filter((p: any) => p && p.package_id)
          .map((p: any) => ({ package_id: parseInt(p.package_id), quantity: Math.max(1, parseInt(p.quantity) || 1) }))
      : (package_id ? [{ package_id: parseInt(package_id), quantity: 1 }] : []);

    for (const selection of selectedPackages) {
      const eligibilityRes = await client.query(
        `SELECT p.name, p.max_age, to_char(c.start_date, 'YYYY-MM-DD') AS convention_start_date
         FROM packages p
         JOIN conventions c ON c.id = p.convention_id
         WHERE p.id = $1`,
        [selection.package_id]
      );
      if (eligibilityRes.rows.length === 0) throw new RegistrationError('El paquete seleccionado no existe.');
      const eligiblePackage = eligibilityRes.rows[0];
      if (eligiblePackage.max_age !== null) {
        const participantAge = ageOnDate(dob, eligiblePackage.convention_start_date);
        if (participantAge === null) {
          throw new RegistrationError(`Debes ingresar una fecha de nacimiento válida para seleccionar ${eligiblePackage.name}.`);
        }
        if (participantAge < 0 || participantAge > eligiblePackage.max_age) {
          throw new RegistrationError(`${eligiblePackage.name} está disponible únicamente para participantes de ${eligiblePackage.max_age} años o menos al inicio de la convención.`);
        }
      }
      await packageService.validatePackageMerchandiseStock(selection.package_id, selection.quantity, client);
    }

    // Check if email already registered
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL', [email]);
    if (existing.rows.length > 0) {
      throw new RegistrationError('Este correo ya está registrado', 409);
    }

    // Get active convention, fall back to most recent convention
    let convRes = await client.query(
      `SELECT id FROM conventions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    );
    let conventionId = convRes.rows.length > 0 ? convRes.rows[0].id : null;

    // If no active convention, try to get the most recent convention
    if (!conventionId) {
      convRes = await client.query(
        `SELECT id FROM conventions ORDER BY created_at DESC LIMIT 1`
      );
      conventionId = convRes.rows.length > 0 ? convRes.rows[0].id : null;
    }

    if (!conventionId) {
      throw new RegistrationError('No convention found. Please create a convention in the admin panel first.');
    }

    const passwordHash = body.password_hash || await bcrypt.hash(password, 10);

    const result = await client.query(
      `INSERT INTO users (name, last_name, email, age, dob, is_preregistered, convention_id, password_hash)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)
       RETURNING id, name, last_name, email, age, dob, is_preregistered, created_at`,
      [name, last_name, email, age || null, dob || null, conventionId, passwordHash]
    );

    // Insert attendance dates if provided
    const userId = result.rows[0].id;
    if (attendance_dates && Array.isArray(attendance_dates) && attendance_dates.length > 0) {
      for (const dateStr of attendance_dates) {
        await client.query(
          `INSERT INTO user_attendance (user_id, convention_id, attendance_date)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, convention_id, attendance_date) DO NOTHING`,
          [userId, conventionId, dateStr]
        );
      }
    }

    // Insert package selections if provided (supports multiple packages, each with a quantity multiplier)
    let totalPackageCost = 0;
    const packageBreakdown: any[] = [];

    for (const selection of selectedPackages) {
      const { package_id: pkgId, quantity } = selection;

      await client.query(
        `INSERT INTO user_packages (user_id, convention_id, package_id, quantity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, convention_id, package_id) DO UPDATE SET quantity = $4`,
        [userId, conventionId, pkgId, quantity]
      );

      // Get package details to check if payment is required
      const packageRes = await client.query(
        `SELECT id, name, regular_voucher_amount, prereg_cost, cost, package_type,
                CASE WHEN prereg_cost IS NOT NULL
                          AND (prereg_start_date IS NULL OR timezone('America/Costa_Rica', now())::date >= prereg_start_date)
                          AND (prereg_end_date IS NULL OR timezone('America/Costa_Rica', now())::date <= prereg_end_date)
                     THEN prereg_cost ELSE cost END AS effective_cost
         FROM packages WHERE id = $1`,
        [pkgId]
      );

      if (packageRes.rows.length > 0) {
        const pkg = packageRes.rows[0];
        const unitCost = pkg.effective_cost;
        const packageCost = unitCost * quantity;
        totalPackageCost += packageCost;
        packageBreakdown.push({ package_id: pkg.id, name: pkg.name, quantity, unit_cost: unitCost, total_cost: packageCost });

        // Only award vouchers if package has no cost (free package)
        if (packageCost === 0 && pkg.regular_voucher_amount > 0) {
          await client.query(
            `INSERT INTO voucher_transactions (user_id, amount, description)
             VALUES ($1, $2, $3)`,
            [userId, pkg.regular_voucher_amount * quantity, `Package registration bonus (${pkg.name} x${quantity})`]
          );
        }

        // Get special vouchers for this package
        const specialVouchersRes = await client.query(
          `SELECT sv.id, sv.amount, sv.name
           FROM package_special_vouchers psv
           JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
           WHERE psv.package_id = $1`,
          [pkgId]
        );

        // Award special vouchers only if package is free (one award record per unit purchased)
        if (packageCost === 0) {
          for (const sv of specialVouchersRes.rows) {
            for (let i = 0; i < quantity; i++) {
              await client.query(
                `INSERT INTO special_voucher_awards (user_id, special_voucher_id, event_id, awarded_by)
                 VALUES ($1, $2, NULL, 'package_registration')`,
                [userId, sv.id]
              );
            }
          }
          await packageService.awardPackageMerchandiseToUser(userId, conventionId, pkgId, quantity, client);
        }
      }
    }

    // Insert event pre-registrations if provided
    if (event_prereg_ids && Array.isArray(event_prereg_ids) && event_prereg_ids.length > 0) {
      const fullName = `${name} ${last_name}`.trim();
      for (const eventId of event_prereg_ids) {
        const capacity = await client.query(
          `SELECT e.name, et.max_players,
                  (SELECT COUNT(*)::int FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count
           FROM events e
           JOIN event_types et ON et.id = e.event_type_id
           WHERE e.id = $1
           FOR UPDATE OF e`,
          [eventId]
        );
        if (capacity.rows.length === 0) throw new RegistrationError('El evento seleccionado no existe.');
        if (capacity.rows[0].participant_count >= capacity.rows[0].max_players) {
          throw new RegistrationError(`${capacity.rows[0].name} ya no tiene espacios disponibles.`, 409);
        }
        await client.query(
          `INSERT INTO event_participants (user_id, event_id, convention_id, preregistered)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (user_id, event_id) DO UPDATE SET preregistered = true`,
          [userId, eventId, conventionId]
        );

        const eventRes = await client.query(`SELECT name FROM events WHERE id = $1`, [eventId]);
        if (eventRes.rows.length > 0) {
          await enqueueGoogleSheetsSync(client, eventRes.rows[0].name, fullName, email);
        }
      }
    }

    return {
      success: true,
      user: result.rows[0],
      package_total_cost: totalPackageCost,
      package_breakdown: packageBreakdown,
    };
}

// POST /public/preregister - Public pre-registration (no API key needed)
router.post('/preregister', registrationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recaptchaValid = await verifyRecaptcha(req.body.recaptcha_token);
    if (!recaptchaValid) throw new RegistrationError('No se pudo verificar el CAPTCHA. Inténtalo de nuevo.');
    res.status(201).json(await withTransaction(client => preregisterParticipant(req.body, client)));
  } catch (err) {
    if (err instanceof RegistrationError) return res.status(err.status).json({ error: err.message });
    if ((err as any)?.code === '23505') return res.status(409).json({ error: 'Este correo ya está registrado.' });
    next(err);
  }
});

router.post('/preregister/batch', registrationLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const participants = req.body.participants;
    if (!Array.isArray(participants) || participants.length < 1 || participants.length > 5) {
      throw new RegistrationError('Debes registrar entre 1 y 5 participantes.');
    }
    for (const participant of participants) {
      if (!participant.name || !participant.last_name || !participant.email || !participant.password) {
        throw new RegistrationError('Todos los participantes deben incluir nombre, apellidos, correo y contraseña.');
      }
      if (!NAME_PATTERN.test(String(participant.name).trim()) || !NAME_PATTERN.test(String(participant.last_name).trim())) {
        throw new RegistrationError('Los nombres solo pueden contener letras, espacios, guiones y apóstrofes.');
      }
      if (String(participant.password).length < 8) {
        throw new RegistrationError('Todas las contraseñas deben tener al menos 8 caracteres.');
      }
    }
    const emails = participants.map((participant: any) => String(participant.email || '').trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      throw new RegistrationError('Cada participante debe usar un correo electrónico diferente.');
    }
    const recaptchaValid = await verifyRecaptcha(req.body.recaptcha_token);
    if (!recaptchaValid) throw new RegistrationError('No se pudo verificar el CAPTCHA. Inténtalo de nuevo.');

    const preparedParticipants = await Promise.all(participants.map(async (participant: any) => ({
      ...participant,
      password_hash: await bcrypt.hash(participant.password, 10),
    })));
    const batchResult = await withTransaction(async client => {
      const existingEmails = await client.query(
        `SELECT email FROM users WHERE LOWER(email) = ANY($1::text[]) AND deleted_at IS NULL`,
        [emails]
      );
      if (existingEmails.rows.length > 0) {
        throw new RegistrationError(`Este correo ya está registrado: ${existingEmails.rows[0].email}`, 409);
      }
      const results = [];
      for (const participant of preparedParticipants) {
        results.push(await preregisterParticipant(participant, client));
      }
      const paidRegistrations = results.filter(registration => registration.package_total_cost > 0);
      let payment: paymentService.PaymentIntent | null = null;
      if (paidRegistrations.length > 0) {
        const total = paidRegistrations.reduce((sum, registration) => sum + registration.package_total_cost, 0);
        payment = await paymentService.createPayment(total);
        await paymentService.storePackagePaymentWithReservations(payment, paidRegistrations.map(registration => registration.user.id), client);
      }
      return { registrations: results, payment };
    });
    res.status(201).json({
      success: true,
      registrations: batchResult.registrations,
      paymentId: batchResult.payment?.id || null,
      paymentUrl: batchResult.payment?.paymentUrl || null,
      amount: batchResult.payment?.amount || 0,
    });
  } catch (err) {
    if (err instanceof RegistrationError) return res.status(err.status).json({ error: err.message });
    if ((err as any)?.code === '23505') return res.status(409).json({ error: 'Este correo ya está registrado.' });
    next(err);
  }
});

// POST /public/payment - Create a payment for a registered user (no API key needed)
// This is used by the registration form to redirect the player to Onvo/TiloPay.
// Payment vouchers are awarded by the webhook when status becomes 'paid'.
router.post('/payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Re-calculate package total from the database so the amount can't be faked
    const pkgRes = await pool.query(
      `SELECT up.package_id, up.quantity, p.regular_voucher_amount,
              CASE WHEN p.prereg_cost IS NOT NULL
                        AND (p.prereg_start_date IS NULL OR timezone('America/Costa_Rica', now())::date >= p.prereg_start_date)
                        AND (p.prereg_end_date IS NULL OR timezone('America/Costa_Rica', now())::date <= p.prereg_end_date)
                   THEN p.prereg_cost ELSE p.cost END AS effective_cost
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = $1`,
      [user_id]
    );

    if (pkgRes.rows.length === 0) {
      return res.status(400).json({ error: 'No packages selected for this user' });
    }
    for (const pkg of pkgRes.rows) {
      await packageService.validatePackageMerchandiseStock(pkg.package_id, pkg.quantity || 1);
    }

    const total = pkgRes.rows.reduce((sum, pkg) => {
      return sum + (pkg.effective_cost * (pkg.quantity || 1));
    }, 0);

    if (total <= 0) {
      return res.status(400).json({ error: 'Package total is 0; no payment needed' });
    }

    const payment = await paymentService.createPayment(total);
    await paymentService.storePackagePaymentWithReservations(payment, [parseInt(user_id, 10)]);

    res.json({
      success: true,
      paymentId: payment.id,
      paymentUrl: payment.paymentUrl,
      amount: payment.amount,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/payment/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userIds = Array.from(new Set((Array.isArray(req.body.user_ids) ? req.body.user_ids : []).map((id: any) => parseInt(id, 10))))
      .filter((id): id is number => Number.isInteger(id));
    if (userIds.length < 1 || userIds.length > 5) {
      return res.status(400).json({ error: 'Se requieren entre 1 y 5 participantes para el pago.' });
    }

    const pkgRes = await pool.query(
      `SELECT up.user_id, up.package_id, up.quantity,
              CASE WHEN p.prereg_cost IS NOT NULL
                        AND (p.prereg_start_date IS NULL OR timezone('America/Costa_Rica', now())::date >= p.prereg_start_date)
                        AND (p.prereg_end_date IS NULL OR timezone('America/Costa_Rica', now())::date <= p.prereg_end_date)
                   THEN p.prereg_cost ELSE p.cost END AS effective_cost
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = ANY($1::int[])`,
      [userIds]
    );
    const packageQuantities = new Map<number, number>();
    for (const pkg of pkgRes.rows) {
      packageQuantities.set(pkg.package_id, (packageQuantities.get(pkg.package_id) || 0) + (pkg.quantity || 1));
    }
    for (const [packageId, quantity] of packageQuantities) {
      await packageService.validatePackageMerchandiseStock(packageId, quantity);
    }
    const total = pkgRes.rows.reduce((sum, pkg) => sum + (pkg.effective_cost * (pkg.quantity || 1)), 0);
    if (total <= 0) return res.status(400).json({ error: 'El total de los paquetes es 0; no se requiere pago.' });

    const payment = await paymentService.createPayment(total);
    await paymentService.storePackagePaymentWithReservations(payment, userIds);
    res.json({ success: true, paymentId: payment.id, paymentUrl: payment.paymentUrl, amount: payment.amount });
  } catch (err) {
    next(err);
  }
});

// GET /public/payment/:id/status - Public payment status/receipt lookup
router.get('/payment/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Payment ID required' });

    const result = await pool.query(
      `SELECT id, user_id, amount, status, created_at, updated_at FROM payments WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    res.json({ success: true, payment: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /public/preregister/check?email=... - Check if email already registered
router.get('/preregister/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    res.json({ registered: existing.rows.length > 0 });
  } catch (err) {
    next(err);
  }
});

// GET /public/convention - Get active convention info
router.get('/convention', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Fetching convention info...');
    let convRes = await pool.query(
      `SELECT id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, scan_mode FROM conventions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    );

    // If no active convention, try to get the most recent convention
    if (convRes.rows.length === 0) {
      console.log('No active convention, fetching most recent...');
      convRes = await pool.query(
        `SELECT id, name, to_char(start_date, 'YYYY-MM-DD') AS start_date, to_char(end_date, 'YYYY-MM-DD') AS end_date, scan_mode FROM conventions ORDER BY created_at DESC LIMIT 1`
      );
    }

    if (convRes.rows.length === 0) {
      return res.status(404).json({ error: 'No convention found. Please create a convention in the admin panel first.' });
    }

    const convention = convRes.rows[0];
    console.log('Convention found:', convention.id, convention.name);

    // Calculate available dates
    const dates: string[] = [];
    if (convention.start_date && convention.end_date) {
      const current = new Date(`${convention.start_date}T12:00:00`);
      const end = new Date(`${convention.end_date}T12:00:00`);
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    }
    console.log('Available dates:', dates.length);

    // Get packages for this convention
    console.log('Fetching packages for convention:', convention.id);
    const packagesRes = await pool.query(
      `SELECT p.*,
              CASE WHEN p.prereg_cost IS NOT NULL
                        AND (p.prereg_start_date IS NULL OR timezone('America/Costa_Rica', now())::date >= p.prereg_start_date)
                        AND (p.prereg_end_date IS NULL OR timezone('America/Costa_Rica', now())::date <= p.prereg_end_date)
                   THEN p.prereg_cost ELSE p.cost END AS effective_cost,
              p.prereg_cost IS NOT NULL
                AND (p.prereg_start_date IS NULL OR timezone('America/Costa_Rica', now())::date >= p.prereg_start_date)
                AND (p.prereg_end_date IS NULL OR timezone('America/Costa_Rica', now())::date <= p.prereg_end_date) AS prereg_active,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', sv.id,
                  'name', sv.name,
                  'amount', sv.amount,
                  'description', sv.description,
                  'icon', sv.icon,
                  'color', sv.color
                ) ORDER BY sv.name)
                FROM package_special_vouchers psv
                JOIN special_vouchers sv ON sv.id = psv.special_voucher_id
                WHERE psv.package_id = p.id
              ), '[]'::json) AS special_vouchers,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'id', pm.id,
                  'item_name', pm.item_name,
                  'image_url', pm.image_url
                ) ORDER BY pm.id)
                FROM package_merchandise pm
                WHERE pm.package_id = p.id
              ), '[]'::json) AS merchandise_items
       FROM packages p
       WHERE p.convention_id = $1 AND p.is_active = TRUE
       ORDER BY p.days ASC, p.cost ASC`,
      [convention.id]
    );
    console.log('Packages found:', packagesRes.rows.length);

    // Get events with preregistration enabled (handle if column doesn't exist)
    console.log('Fetching events for convention:', convention.id);
    let eventsRes;
    try {
      eventsRes = await pool.query(
        `SELECT e.id, e.name, e.schedule_day, e.start_time, e.end_time, e.track,
                et.max_players, et.entry_cost_colones, et.category, et.format
         FROM events e
         JOIN event_types et ON e.event_type_id = et.id
         WHERE e.convention_id = $1 AND e.preregistration_enabled = TRUE
         ORDER BY e.schedule_day ASC NULLS LAST, e.start_time ASC NULLS LAST, e.created_at ASC`,
        [convention.id]
      );
      console.log('Events found:', eventsRes.rows.length);
    } catch (err) {
      // If preregistration_enabled column doesn't exist, return empty events
      console.error('Error querying events (preregistration_enabled column may not exist):', err);
      eventsRes = { rows: [] };
    }

    const scheduleRes = await pool.query(
      `SELECT e.id, e.name, e.schedule_day, e.start_time, e.end_time, e.track,
              e.sort_order, e.schedule_color, e.status, et.category, et.format
       FROM events e
       JOIN event_types et ON e.event_type_id = et.id
       WHERE e.convention_id = $1 AND e.schedule_day IS NOT NULL
       ORDER BY e.schedule_day ASC, e.sort_order ASC, e.start_time ASC NULLS LAST, e.created_at ASC`,
      [convention.id]
    );

    res.json({ convention, available_dates: dates, packages: packagesRes.rows, events: eventsRes.rows, schedule: scheduleRes.rows, payment_provider: paymentService.PROVIDER });
  } catch (err) {
    console.error('Error in /public/convention:', err);
    next(err);
  }
});

export default router;
