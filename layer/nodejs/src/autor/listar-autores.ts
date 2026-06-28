import {
  Autor,
  AutorAdapter,
  AutorDTO,
  UseCaseInterface,
  PageDataType,
  AutorInterface,
  LogService,
  AutorInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ListarAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private logService = new LogService('ListarAutorUseCase');
  /**
   *
   */
  constructor(
    private _repository: RepositoryInterface,
    private idExecucao?: string
  ) {
    this._tabelaAutores = process.env.TABELA_AUTORES ?? 'Autores';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      this.logService.info(
        '✅ Início da execução do caso de uso ListarAutorUseCase',
        { label: 'ListarAutorUseCase', ...(this.idExecucao && { logId: this.idExecucao }) },
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
      this.logService.info(
        '🔍 Informações para buscar autores definidas.',
        { label: 'ListarAutorUseCase', ...(this.idExecucao && { logId: this.idExecucao }) },
        {
          page,
          limit,
          sortBy,
          sortOrder,
        }
      );

      const result: ResultType = await this._repository.getAll(this._tabelaAutores, {
        page,
        limit,
        sortBy,
        sortOrder,
      });
      this.logService.info(
        '✅ Dados de autores recuperados',
        {
          label: 'ListarAutorUseCase',
          ...(this.idExecucao && { logId: this.idExecucao }),
          total: result.totalDocuments,
        },
        { result }
      );

      const entities = result.data.map((item: AutorInterface) =>
        Autor.create(item, Object.getOwnPropertyDescriptor(item, 'id')?.value ?? '')
      );
      this.logService.info(
        '✅ Entidades de autores criadas.',
        { label: 'ListarAutorUseCase', ...(this.idExecucao && { logId: this.idExecucao }) },
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
        { label: 'ListarAutorUseCase', ...(this.idExecucao && { logId: this.idExecucao }), data },
        error as Error
      );
      throw new AutorInvalidoError('Falha ao listar autores.');
    }
  }
}
