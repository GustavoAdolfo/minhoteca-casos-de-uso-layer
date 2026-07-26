import {
  Autor,
  AutorAdapter,
  AutorDTO,
  UseCaseInterface,
  PageDataType,
  AutorInterface,
  LogService,
  AutorInvalidoError,
  PaisDTO,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ListarAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private _tabelaPaises: string;
  private logService = new LogService('ListarAutorUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tabelaAutores = process.env.TABELA_AUTORES ?? 'Autores';
    this._tabelaPaises = process.env.TABELA_PAISES ?? 'Paises';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    try {
      this.logService.info(
        '✅ Início da execução do caso de uso ListarAutorUseCase',
        { label: 'ListarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        { data }
      );

      const page = data.queryStringParameters?.page
        ? parseInt(data.queryStringParameters.page, 10)
        : 1;
      const limit = data.queryStringParameters?.limit
        ? parseInt(data.queryStringParameters.limit, 10)
        : 10;
      const queryParams = data.queryStringParameters ?? {};
      const sortEntry = Object.entries(queryParams).find(
        ([key]) => key.startsWith('sort[') && key.endsWith(']')
      );
      const filterEntry = Object.entries(queryParams).find(
        ([key]) => key.startsWith('filter[') && key.endsWith(']')
      );

      const sortBy =
        queryParams.sortBy || (sortEntry ? sortEntry[0].slice('sort['.length, -1) : '') || 'nome';
      const sortOrder = queryParams.sortOrder || sortEntry?.[1] || 'asc';
      let filterKey =
        queryParams.filterKey || (filterEntry ? filterEntry[0].slice('filter['.length, -1) : '');
      let filterValue: string | string[] | number | number[] =
        queryParams.filterValue || filterEntry?.[1] || queryParams.filter || '';
      this.logService.info(
        '🔍 Informações para buscar autores definidas.',
        { label: 'ListarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        {
          page,
          limit,
          sortBy,
          sortOrder,
          filterKey,
          filterValue,
        }
      );

      if (filterKey && filterKey.toLowerCase() === 'pais') {
        // Para obter todos os países que contenham no nome o valor do filtro, e então buscar os autores desses países
        const paisesResult = await this._repository.getAll(this._tabelaPaises, {
          page: 1,
          limit: 1000,
          filterKey: 'nomePortugues',
          filterValue,
        });
        const paisesId: number[] = paisesResult?.data.map((pais: PaisDTO) => pais.isoNumeric);
        if (paisesId && paisesId.length > 0) {
          filterKey = 'idPais';
          filterValue = paisesId;
        } else {
          return createResult([], 204, 'Nenhum país encontrado com o nome informado.', {
            page,
            totalItems: 0,
            totalPages: 0,
          });
        }
      }

      if (filterKey && filterKey.toLowerCase() === 'totallivros') {
        filterValue = parseInt(filterValue as string, 10);
      }

      const queryOptions = {
        page,
        limit,
        sortBy,
        sortOrder,
        ...(filterKey && filterValue && { filterKey, filterValue }),
      };

      const result: ResultType = await this._repository.getAll(this._tabelaAutores, queryOptions);
      this.logService.info(
        '✅ Dados de autores recuperados',
        {
          label: 'ListarAutorUseCase',
          ...(idExecucao && { logId: idExecucao }),
          total: result.totalDocuments,
        },
        { result }
      );

      const entities = result.data.map((item: AutorInterface) =>
        Autor.create(item, Object.getOwnPropertyDescriptor(item, 'id')?.value ?? '')
      );
      this.logService.info(
        '✅ Entidades de autores criadas.',
        { label: 'ListarAutorUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entities }
      );

      const autores: AutorDTO[] = AutorAdapter.toDTOList(entities);
      return createResult(
        autores,
        autores.length > 0 ? 200 : 204,
        autores.length > 0 ? 'Autores listados com sucesso' : 'Nenhum autor encontrado',
        {
          page: result.currentPage ?? page,
          totalItems: result.totalDocuments ?? autores.length,
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
      this.logService.error(
        'Erro ao listar autores:',
        { label: 'ListarAutorUseCase', ...(idExecucao && { logId: idExecucao }), data },
        error as Error
      );
      throw new AutorInvalidoError('Falha ao listar autores.');
    }
  }
}
