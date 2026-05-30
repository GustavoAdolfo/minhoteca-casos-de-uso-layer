import {
  Editora,
  EditoraAdapter,
  EditoraDTO,
  UseCaseInterface,
  PageDataType,
  EditoraInterface,
  LogService,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ListarEditoraUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('ListarEditoraUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.TABELA_EDITORAS || 'Editoras';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      this.logService.info(
        '✅ Início da execução do caso de uso ListarEditoraUseCase',
        {},
        { data }
      );

      const page = data.queryStringParameters?.page
        ? parseInt(data.queryStringParameters.page, 10)
        : 1;
      const limit = data.queryStringParameters?.limit
        ? parseInt(data.queryStringParameters.limit, 10)
        : 10;
      const sortBy = data.queryStringParameters?.sortBy || 'nome';
      const sortOrder = data.queryStringParameters?.sortOrder || 'asc';
      this.logService.info('🔍 Informações para buscar editoras definidas.', {
        page,
        limit,
        sortBy,
        sortOrder,
      });

      const result: ResultType = await this._repository.getAll(this._tableName, {
        page,
        limit,
        sortBy,
        sortOrder,
      });
      this.logService.info(
        '✅ Dados de editoras recuperados',
        {
          total: result.totalDocuments,
        },
        { result }
      );

      const entities = result.data.map((item: EditoraInterface) =>
        Editora.create(item, Object.getOwnPropertyDescriptor(item, 'id')?.value ?? '')
      );
      this.logService.info('✅ Entidades de editoras criadas.', {}, { entities });

      const editoras: EditoraDTO[] = EditoraAdapter.toDTOList(entities);
      return createResult(
        editoras,
        editoras.length > 0 ? 200 : 204,
        editoras.length > 0 ? 'Editoras listadas com sucesso' : 'Nenhuma editora encontrada',
        {
          page: result.currentPage ?? page,
          totalItems: result.totalDocuments ?? editoras.length,
          totalPages: result.totalPages ?? 0,
          ...(result.hasNextPage && {
            nextPage: `?page=${page + 1}&limit=${limit}${sortBy && sortOrder && `&sortBy=${sortBy}&sortOrder=${sortOrder}`}`,
          }),
          ...(result.hasPrevPage && {
            prevPage: `?page=${page - 1}&limit=${limit}${sortBy && sortOrder && `&sortBy=${sortBy}&sortOrder=${sortOrder}`}`,
          }),
        }
      );
    } catch (error) {
      this.logService.error('Erro ao listar editoras:', error as Error);
      throw new Error('Falha ao listar editoras.', { cause: error });
    }
  }
}
