import {
  AutorDTO,
  AutorAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
  AutorInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class CriarAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private logService = new LogService('CriarAutorUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaAutores = process.env.TABELA_AUTORES ?? 'Autores';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    this.logService.info(
      'Iniciando caso de uso de criar autor.',
      { label: 'CriarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
      { data }
    );
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info(
        'Dados recebidos para gravação',
        { label: 'CriarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        { body }
      );

      const entity = AutorAdapter.fromCreateDTO(body);
      this.logService.info(
        'Dados convertidos para entidade',
        { label: 'CriarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entity }
      );

      await this._repository.saveData(this._tabelaAutores, JSON.parse(entity.toJSONString()));
      this.logService.info(
        'Autor gravado com sucesso',
        { label: 'CriarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entity }
      );
      const autorDTO: AutorDTO = AutorAdapter.toDTO(entity);

      this.logService.info(
        'Dados convertidos para DTO de retorno',
        { label: 'CriarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        { autorDTO }
      );
      return createResult([autorDTO], 201, 'Autor criado com sucesso');
    } catch (error) {
      this.logService.error(
        'Erro ao criar autor:',
        { label: 'CriarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new AutorInvalidoError('Falha ao criar autor.');
    }
  }
}
