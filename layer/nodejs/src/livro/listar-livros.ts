import {
  Livro,
  LivroAdapter,
  LivroDTO,
  LivroInterface,
  UseCaseInterface,
  PageDataType,
  LogService,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ListarLivroUseCase implements UseCaseInterface {
  private _tabelaLivros: string;
  private logService = new LogService('ListarLivroUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaLivros = process.env.TABELA_LIVROS || 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      this.logService.info('✅ Início da execução do caso de uso ListarLivroUseCase', {}, { data });

      const page = data.queryStringParameters?.page
        ? parseInt(data.queryStringParameters.page, 10)
        : 1;
      const limit = data.queryStringParameters?.limit
        ? parseInt(data.queryStringParameters.limit, 10)
        : 10;
      const sortBy = data.queryStringParameters?.sortBy || 'titulo';
      const sortOrder = data.queryStringParameters?.sortOrder || 'asc';
      this.logService.info('🔍 Informações para buscar livros definidas.', {
        page,
        limit,
        sortBy,
        sortOrder,
      });

      const result: ResultType = await this._repository.getAll(this._tabelaLivros, {
        page,
        limit,
        sortBy,
        sortOrder,
      });
      this.logService.info(
        '✅ Dados de livros recuperados',
        {
          total: result.totalDocuments,
        },
        { result }
      );

      const entities = result.data.map((item: LivroInterface) =>
        Livro.create(item, Object.getOwnPropertyDescriptor(item, 'id')?.value ?? '')
      );
      this.logService.info('✅ Entidades de livros criadas.', {}, { entities });

      const livros: LivroDTO[] = LivroAdapter.toDTOList(entities);
      return createResult(
        livros,
        livros.length > 0 ? 200 : 204,
        livros.length > 0 ? 'Livros listados com sucesso' : 'Nenhum livro encontrado',
        {
          page: result.currentPage ?? page,
          totalItems: result.totalDocuments ?? livros.length,
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
      this.logService.error('Erro ao listar livros:', error as Error);
      throw new Error('Falha ao listar livros.', { cause: error });
    }
  }
}
