import { LogService, PageDataType, UseCaseInterface } from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ExcluirEditoraUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('ExcluirEditoraUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.EDITORA_TABLE_NAME || 'Editoras';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      const result = await this._repository.deleteByMinhotecaId(
        this._tableName,
        data.queryStringParameters?.id ?? ''
      );
      return createResult(result.data, 200, 'Editora excluída com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir editora:', error);
      throw new Error('Falha ao excluir editora.');
    }
  }
}
