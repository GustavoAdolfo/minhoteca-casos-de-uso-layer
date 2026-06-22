import {
  Editora,
  PageDataType,
  EditoraAdapter,
  UseCaseInterface,
  EditoraInterface,
  LogService,
  EditoraInvalidaError,
} from '@gustavoadolfo/minhoteca-core-layer';
import {
  KeyValueAttr,
  RepositoryInterface,
  ResultType,
} from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ObterEditoraUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('ObterEditoraUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.TABELA_EDITORAS || 'Editoras';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      const editoraId = data.pathParameters?.id ?? data.queryStringParameters?.id;
      if (editoraId) {
        const attributes: KeyValueAttr[] = [
          {
            attribute: {
              AttributeName: 'id',
              AttributeType: 'S',
            },
            attributeValue: editoraId,
            partitionKey: false,
            sortKey: false,
          },
        ];
        const result: ResultType = await this._repository.queryData(this._tableName, attributes);
        if (result) {
          const editoraEntity = Editora.create(
            result.data[0] as EditoraInterface,
            Object.getOwnPropertyDescriptor(result.data[0], 'id')?.value
          );
          const resultDTO = EditoraAdapter.toDTO(editoraEntity);
          return createResult([resultDTO], 200, 'Editora obtida com sucesso.');
        }
        this.logService.warn('Editora não encontrada.', { editoraId });
        return createResult([], 404, 'Editora não encontrada.');
      }

      throw new EditoraInvalidaError('ID da editora não informado.');
    } catch (error) {
      EditoraInvalidaError;
      this.logService.error('Erro ao obter editora:', {}, error as Error);
      throw new EditoraInvalidaError('Falha ao obter editora.');
    }
  }
}
