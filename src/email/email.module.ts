import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // Import ConfigModule to use ConfigService in EmailService
  providers: [EmailService],
  exports: [EmailService], // Export EmailService so it can be used in other modules
})
export class EmailModule {}
