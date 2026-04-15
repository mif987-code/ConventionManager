import { Router, Request, Response, NextFunction } from 'express';
import { handleNfcScan, handleQrScan } from '../services/nfcService';
import { getBalance, getTransactionHistory } from '../services/transactionService';

const router = Router();

// POST /api/scan - Scan NFC tag and return user info with balances
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nfc_uid } = req.body;

    if (!nfc_uid) {
      return res.status(400).json({ error: 'nfc_uid is required' });
    }

    const result = await handleNfcScan(nfc_uid);

    if (!result.found) {
      return res.status(404).json(result);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/scan/qr - Scan QR code and return user info with balances
router.post('/qr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qr_code } = req.body;

    if (!qr_code) {
      return res.status(400).json({ error: 'qr_code is required' });
    }

    const result = await handleQrScan(qr_code);

    if (!result.found) {
      return res.status(404).json(result);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/scan/balance - Quick balance check via NFC
router.post('/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nfc_uid } = req.body;

    if (!nfc_uid) {
      return res.status(400).json({ error: 'nfc_uid is required' });
    }

    const result = await handleNfcScan(nfc_uid);
    if (!result.found || !result.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user_id: result.user.id,
      name: result.user.name,
      voucher_balance: result.user.voucher_balance,
      tix_balance: result.user.tix_balance,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/scan/qr/balance - Quick balance check via QR code
router.post('/qr/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qr_code } = req.body;

    if (!qr_code) {
      return res.status(400).json({ error: 'qr_code is required' });
    }

    const result = await handleQrScan(qr_code);
    if (!result.found || !result.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user_id: result.user.id,
      name: result.user.name,
      voucher_balance: result.user.voucher_balance,
      tix_balance: result.user.tix_balance,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
