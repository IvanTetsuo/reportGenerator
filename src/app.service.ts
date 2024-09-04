import { Injectable, StreamableFile} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportQueue } from './entities/ReportQueue';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';
import { StatusQueue } from './types';
import xlsx from 'node-xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { average } from './utils';

type ReportRecord = {
  student_name: string;
  math: number[];
  russian: number[];
  programming: number[];
  avgMath: number;
  avgRussian: number;
  avgProgramming: number;
  avgMark: number;
};
type Report = Record<string, ReportRecord>;

export type GenerateTaskParams = {
  serviceName: string;
  dataEndpoint: string;
  tableHeaders: string[];
};

export type IsReportReady = {
  documentId: number;
  isReady: boolean;
  downloadURL?: string;
}

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(ReportQueue)
    private reportRepository: Repository<ReportQueue>,
  ) {}

  async createTask({
    serviceName,
    dataEndpoint,
    tableHeaders,
  }: GenerateTaskParams): Promise<{ documentId: number }> {
    const newReportTask = this.reportRepository.create({
      serviceName,
      dataEndpoint,
      tableHeaders,
    });
    await this.reportRepository.save(newReportTask);
    return { documentId: newReportTask.id };
  }

  async isReady(documentId: string): Promise<IsReportReady> {
    const report = await this.reportRepository.findOneBy({id: +documentId});
    if (!report) {
      throw new Error('Отчёт не найден');
    }
    const isReady = report.status === StatusQueue.Processed;
    const result: IsReportReady = {
      isReady,
      documentId: +documentId,
    };
    if (isReady) {
      result.downloadURL = `http://localhost:5000/download-report/${documentId}`;
    }
    return result;
  }

  getReportFile(documentId: string): StreamableFile {
    const outputDir = path.join(process.cwd(), 'output');
    const filePath = path.join(outputDir, `report_${documentId}.xlsx`);
    const file = fs.createReadStream(filePath);
    return new StreamableFile(file, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="report_${documentId}.xlsx"`,
    });
  }

  @Interval(1000)
  async checkQueue() {
    const unprocessedRequest = await this.reportRepository.findOne({
      where: {
        status: StatusQueue.NotProcessed,
      },
    });
    if (!unprocessedRequest) {
      return;
    }
    const { id, serviceName, dataEndpoint, tableHeaders } = unprocessedRequest;
    unprocessedRequest.status = StatusQueue.InProcess;
    await this.reportRepository.save(unprocessedRequest);
    let bigObject;
    try {
      bigObject = await axios.get(dataEndpoint);
    } catch(err) {
      unprocessedRequest.status = StatusQueue.Error;
      await this.reportRepository.save(unprocessedRequest);
      return;
    }
    const dataForReport = bigObject.data;
    const report: Report = {};
    for (const obj of dataForReport) {
      if (!report[obj.student_name]) {
        report[obj.student_name] = {
          student_name: obj.student_name,
          math: [],
          russian: [],
          programming: [],
          avgMath: 0,
          avgRussian: 0,
          avgProgramming: 0,
          avgMark: 0,
        };
      }
      const reportRecord = report[obj.student_name];
      reportRecord[obj.subject_name].push(obj.mark);
    }
    for (const reportRecord of Object.values(report)) {
      reportRecord.avgMath = average(reportRecord.math);
      reportRecord.avgRussian = average(reportRecord.russian);
      reportRecord.avgProgramming = average(reportRecord.programming);
      reportRecord.avgMark = average([
        reportRecord.avgMath,
        reportRecord.avgRussian,
        reportRecord.avgProgramming
      ]);
    }

    // Подготовка данных для Excel
    const excelData = [];

    // Заголовок
    excelData.push(tableHeaders);

    // Добавление строк с данными
    Object.values(report).forEach((student) => {
      excelData.push([
        student.student_name,
        student.math.join(', '),
        student.russian.join(', '),
        student.programming.join(', '),
        student.avgMath,
        student.avgRussian,
        student.avgProgramming,
        student.avgMark
      ]);
    });

    // Создание рабочего листа
    const worksheet: any = [{ name: 'Students', data: excelData }];

    // Создание файла Excel
    const buffer = xlsx.build(worksheet);

    // Определяем путь к папке и файлу
    const outputDir = path.join(process.cwd(), 'output');
    const filePath = path.join(outputDir, `report_${id}.xlsx`);

    // Проверяем, существует ли папка, и создаём её, если она не существует
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Сохранение файла
    fs.writeFileSync(filePath, buffer);

    // Меняем статус на "Завершено"
    unprocessedRequest.status = StatusQueue.Processed;
    await this.reportRepository.save(unprocessedRequest);
  }
}
