import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM || 'SparkFest <onboarding@resend.dev>';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Send an email with user's QR badge.
 */
export async function sendQRCodeEmail(to: string, userName: string, qrCodeDataUrl: string): Promise<boolean> {
  if (!resend) {
    console.warn('[EmailService] RESEND_API_KEY is not configured. Skipping email.');
    return false;
  }
  if (!to) return false;

  try {
    // Extract base64 image content if present
    const base64Match = qrCodeDataUrl.match(/^data:image\/png;base64,(.+)$/);
    const attachments = base64Match
      ? [
          {
            filename: 'sparkfest-qr-badge.png',
            content: base64Match[1],
          },
        ]
      : [];

    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Tu Código QR de Acceso - SparkFest',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
          <h2 style="color: #818cf8; margin-top: 0; text-align: center;">¡Hola, ${userName}!</h2>
          <p style="text-align: center; color: #94a3b8; font-size: 15px;">
            Este es tu código QR personal para <strong>SparkFest</strong>. Presenta este código en la entrada o ante los organizadores para acceder a tus eventos y activar tu cuenta.
          </p>
          <div style="text-align: center; margin: 24px 0; padding: 16px; background: #1e293b; border-radius: 8px;">
            <img src="${qrCodeDataUrl}" alt="SparkFest QR Code" style="width: 220px; height: 220px; border-radius: 8px; background: white; padding: 8px;" />
          </div>
          <p style="text-align: center; font-size: 13px; color: #64748b; margin-bottom: 0;">
            También puedes ver tu código QR y saldo en cualquier momento iniciando sesión en <a href="https://register.sparkfestcr.com/app/" style="color: #818cf8; text-decoration: underline;">Convention Player App</a>.
          </p>
        </div>
      `,
      attachments,
    });
    console.log(`[EmailService] QR code email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('[EmailService] Failed to send QR code email:', err);
    return false;
  }
}

/**
 * Send an email confirming account activation.
 */
export async function sendPasswordResetEmail(to: string, userName: string, resetUrl: string): Promise<boolean> {
  if (!resend || !to) return false;

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Restablece tu contraseña de SparkFest',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
          <h2 style="color: #818cf8; margin-top: 0; text-align: center;">Restablecer contraseña</h2>
          <p style="color: #94a3b8; font-size: 15px;">Hola <strong>${userName}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta de SparkFest.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Crear nueva contraseña</a>
          </div>
          <p style="color: #64748b; font-size: 13px;">Este enlace vence en una hora y solo puede utilizarse una vez. Si no solicitaste este cambio, puedes ignorar este correo.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('[EmailService] Failed to send password reset email:', err);
    return false;
  }
}

export async function sendActivationEmail(to: string, userName: string): Promise<boolean> {
  if (!resend) {
    console.warn('[EmailService] RESEND_API_KEY is not configured. Skipping email.');
    return false;
  }
  if (!to) return false;

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: '¡Tu cuenta de SparkFest ha sido activada!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f1f5f9; border-radius: 12px;">
          <h2 style="color: #22c55e; margin-top: 0; text-align: center;">¡Cuenta Activada!</h2>
          <p style="text-align: center; color: #94a3b8; font-size: 15px;">
            Hola <strong>${userName}</strong>, tu entrada/cuenta ha sido verificada y activada exitosamente por el equipo de organización.
          </p>
          <div style="margin: 20px 0; padding: 16px; background: #1e293b; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #f1f5f9; font-weight: bold; font-size: 16px;">¡Ya estás listo para jugar!</p>
            <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px;">
              Ya puedes unirte a eventos abiertos, utilizar tus vouchers y ver tus resultados en vivo.
            </p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://register.sparkfestcr.com/app/" style="background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
              Abrir Player App
            </a>
          </div>
        </div>
      `,
    });
    console.log(`[EmailService] Activation email sent to ${to}`);
    return true;
  } catch (err) {
    console.error('[EmailService] Failed to send activation email:', err);
    return false;
  }
}
