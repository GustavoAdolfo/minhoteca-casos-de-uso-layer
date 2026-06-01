import {
  Pais,
  PaisAdapter,
  PaisDTO,
  UseCaseInterface,
  PageDataType,
  PaisInterface,
  LogService,
  PaisInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ListarPaisUseCase implements UseCaseInterface {
  private _tableName: string;
  private logService = new LogService('ListarPaisUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tableName = process.env.TABELA_PAISES || 'Paises';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      this.logService.info('✅ Início da execução do caso de uso ListarPaisUseCase', {}, { data });

      const page = data.queryStringParameters?.page
        ? parseInt(data.queryStringParameters.page, 10)
        : 1;
      const limit = data.queryStringParameters?.limit
        ? parseInt(data.queryStringParameters.limit, 10)
        : 10;
      const sortBy = data.queryStringParameters?.sortBy || 'nomePortugues';
      const sortOrder = data.queryStringParameters?.sortOrder || 'asc';
      this.logService.info('🔍 Informações para buscar países definidas.', {
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
        '✅ Dados de países recuperados',
        {
          total: result.totalDocuments,
        },
        { result }
      );

      const entities = result.data.map((item: PaisInterface) => Pais.create(item));
      this.logService.info('✅ Entidades de países criadas.', {}, { entities });

      const paises: PaisDTO[] = PaisAdapter.toDTOList(entities);
      return createResult(
        paises,
        paises.length > 0 ? 200 : 204,
        paises.length > 0 ? 'Países listadas com sucesso' : 'Nenhuma editora encontrada',
        {
          page: result.currentPage ?? page,
          totalItems: result.totalDocuments ?? paises.length,
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
      this.logService.error('Erro ao listar países:', { data }, error as Error);
      throw new PaisInvalidoError('Falha ao listar países.');
    }
  }
}
