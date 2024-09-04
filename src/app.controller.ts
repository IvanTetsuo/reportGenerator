import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  StreamableFile
} from '@nestjs/common';
import { AppService, GenerateTaskParams } from './app.service';
import { IsReportReady } from './app.service';
import { HttpStatus, HttpException } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('generate-report')
  async createTask(
    @Body() body: GenerateTaskParams,
  ): Promise<{ documentId: number }> {
    return this.appService.createTask(body);
  }

  @Get('is-ready/:documentId')
  async isReady(@Param('documentId') documentId?: string): Promise<IsReportReady> {
    if (!documentId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    try {
      return await this.appService.isReady(documentId);
    } catch(err) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  @Get('download-report/:documentId')
  downloadReport(@Param('documentId') documentId?: string): StreamableFile {
    if (!documentId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    try {
      return this.appService.getReportFile(documentId);
    } catch(err) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }
}
