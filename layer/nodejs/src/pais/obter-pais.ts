import {
  Pais,
  PageDataType,
  PaisAdapter,
  UseCaseInterface,
  PaisInterface,
  LogService,
  PaisInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import {
  KeyValueAttr,
  RepositoryInterface,
  ResultType,
} from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ObterPaisUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('ObterPaisUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.TABELA_PAISES || 'Paises';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    try {
      const paisId = data.pathParameters?.id ?? data.queryStringParameters?.id;
      if (paisId) {
        const attributes: KeyValueAttr[] = [
          {
            attribute: {
              AttributeName: 'isoNumeric',
              AttributeType: 'S',
            },
            attributeValue: paisId,
            partitionKey: false,
            sortKey: false,
          },
        ];
        const result: ResultType = await this._repository.queryData(this._tableName, attributes);
        if (result?.data?.length > 0) {
          const paisEntity = Pais.create(result.data[0] as PaisInterface);
          const resultDTO = PaisAdapter.toDTO(paisEntity);
          return createResult([resultDTO], 200, 'País obtido com sucesso.');
        }
        this.logService.warn(`País com id ${paisId} não encontrado.`);
        return createResult([], 404, 'País não encontrado.');
      }

      throw new PaisInvalidoError('ID do país não informado.');
    } catch (error) {
      this.logService.error(
        'Erro ao obter país:',
        { ...(idExecucao && { logId: idExecucao }), data },
        error as Error
      );
      throw new PaisInvalidoError('Falha ao obter país.');
    }
  }
}
