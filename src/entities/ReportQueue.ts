import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { StatusQueue } from 'src/types';

@Entity()
export class ReportQueue {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  serviceName!: string;

  @Column({ type: 'varchar', length: 100 })
  dataEndpoint!: string;

  @Column('varchar', { array: true })
  tableHeaders!: string[];

  @Column({ type: 'int', default: 0 })
  status!: StatusQueue;
}
