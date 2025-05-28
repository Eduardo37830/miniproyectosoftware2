import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<string>('EMAIL_SECURE') === 'true', // Convert string to boolean
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
      // Adding TLS options for Gmail, common for port 587
      tls: {
        ciphers: 'SSLv3',
      },
    });
  }

  async sendVerificationEmail(to: string, code: string) {
    const mailOptions = {
      from: `"Your App Name" <${this.configService.get<string>('EMAIL_USER')}>`, // Optional: Set a sender name
      to,
      subject: 'Confirm Your Email Address',
      text: `Hello,\n\nThank you for registering. Please use the following code to verify your email address:\n\n${code}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe Team`,
      html: `<p>Hello,</p><p>Thank you for registering. Please use the following code to verify your email address:</p><p><strong>${code}</strong></p><p>This code will expire in 5 minutes.</p><p>If you did not request this, please ignore this email.</p><p>Thanks,<br/>The Team</p>`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent successfully to:', to);
    } catch (error) {
      console.error('Error sending verification email:', error);
      // Depending on your error handling strategy, you might want to throw an exception
      // throw new InternalServerErrorException('Could not send verification email.');
    }
  }
}
