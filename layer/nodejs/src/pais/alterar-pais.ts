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

export class AlterarPaisUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('AlterarPaisUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.TABELA_PAISES || 'Paises';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('Início a execução do caso de uso AlterarPaisUseCase', {}, { data });
    try {
      const dto = JSON.parse(data.body ?? '{}') as PaisDTO;
      if (!dto.isoNumeric || dto.isoNumeric === 0) {
        this.logService.error('ID do país é obrigatório para alteração.');
        throw new PaisInvalidoError('ID do país é obrigatório para alteração.');
      }

      const entity = PaisAdapter.fromCreateDTO(dto);

      const result = await this._repository.updateByMinhotecaId(
        this._tableName,
        JSON.parse(entity.toJSONString()),
        dto.isoNumeric.toString()
      );

      return createResult(result.data, 200, 'País alterado com sucesso');
    } catch (error) {
      this.logService.error('Erro ao alterar país:', {}, error as Error);
      throw new PaisInvalidoError('Falha ao alterar país.');
    }
  }
}
