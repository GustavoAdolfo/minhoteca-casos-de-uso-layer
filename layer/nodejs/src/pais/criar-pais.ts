import {
  PaisDTO,
  PaisAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
  PaisInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class CriarPaisUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('CriarPaisUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.TABELA_PAISES || 'Paises';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('🏁 Iniciando caso de uso de criar país.');
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info('Dados recebidos para gravação', { body });

      const entity = PaisAdapter.fromCreateDTO(body);
      this.logService.info('Dados convertidos para entidade', { entity });

      await this._repository.saveData(this._tableName, JSON.parse(entity.toJSONString()));
      this.logService.info('País gravado com sucesso', { entity });
      const paisDTO: PaisDTO = PaisAdapter.toDTO(entity);

      this.logService.info('Dados convertidos para DTO de retorno', { paisDTO });
      return createResult([paisDTO], 201, 'País criado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao criar país:', {}, error as Error);
      throw new PaisInvalidoError('Falha ao criar país.');
    }
  }
}
