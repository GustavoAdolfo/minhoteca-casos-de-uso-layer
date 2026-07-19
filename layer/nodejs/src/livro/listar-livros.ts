import {
  Autor,
  Livro,
  AutorAdapter,
  LivroAdapter,
  LivroDTO,
  LivroInterface,
  UseCaseInterface,
  PageDataType,
  LogService,
  LivroInvalidoError,
  AutorDTO,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ListarLivroUseCase implements UseCaseInterface {
  private _tabelaLivros: string;
  private _tabelaAutores: string;
  private logService = new LogService('ListarLivroUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaLivros = process.env.TABELA_LIVROS ?? 'Livros';
    this._tabelaAutores = process.env.TABELA_AUTORES ?? 'Autores';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    try {
      this.logService.info(
        '✅ Início da execução do caso de uso ListarLivroUseCase',
        { label: 'ListarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
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
        queryParams.sortBy || (sortEntry ? sortEntry[0].slice('sort['.length, -1) : '') || 'titulo';
      const sortOrder = queryParams.sortOrder || sortEntry?.[1] || 'asc';
      let filterKey =
        queryParams.filterKey || (filterEntry ? filterEntry[0].slice('filter['.length, -1) : '');
      let filterValue: string | string[] =
        queryParams.filterValue || filterEntry?.[1] || queryParams.filter || '';
      this.logService.info(
        '🔍 Informações para buscar livros definidas.',
        { label: 'ListarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        {
          page,
          limit,
          sortBy,
          sortOrder,
          filterKey,
          filterValue,
        }
      );

      if (filterKey && filterKey.toLowerCase() === 'autor') {
        // Para obter todos os autores que contenham no nome o valor do filtro, e então buscar os livros desses autores
        const autoresResult = await this._repository.getAll(this._tabelaAutores, {
          page: 1,
          limit: 1000,
          filterKey,
          filterValue,
        });
        const autoresIds: string[] = autoresResult?.data.map((autor: AutorDTO) => autor.id);
        if (autoresIds && autoresIds.length > 0) {
          filterKey = 'autorId';
          filterValue = autoresIds;
        } else {
          return createResult([], 204, 'Nenhum livro encontrado para o nome de autor informado.', {
            page,
            totalItems: 0,
            totalPages: 0,
          });
        }
      }

      const queryOptions = {
        page,
        limit,
        sortBy,
        sortOrder,
        ...(filterKey && filterValue && { filterKey, filterValue }),
      };

      const result: ResultType = await this._repository.getAll(this._tabelaLivros, queryOptions);
      this.logService.info(
        '✅ Dados de livros recuperados',
        {
          label: 'ListarLivroUseCase',
          ...(idExecucao && { logId: idExecucao }),
          total: result.totalDocuments,
        },
        { result }
      );

      const entities = result.data.map((item: LivroInterface) =>
        Livro.create(item, Object.getOwnPropertyDescriptor(item, 'id')?.value ?? '')
      );
      this.logService.info(
        '✅ Entidades de livros criadas.',
        { label: 'ListarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entities }
      );

      const livros: LivroDTO[] = LivroAdapter.toDTOList(entities);
      const autoresIds = livros
        .map((livro) => livro.autorId)
        .filter((id) => !!id)
        .reduce((acc: string[], id: string) => {
          if (!acc.includes(id)) {
            acc.push(id);
          }
          return acc;
        }, []);
      this.logService.info(
        '✅ IDs de autores extraídos dos livros.',
        { label: 'ListarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        { autoresIds }
      );

      const autores: ResultType = autoresIds.length
        ? await this._repository.getListByMinhotecaIds('Autores', autoresIds)
        : ({ data: [] } as ResultType);
      this.logService.info(
        '✅ Dados de autores recuperados.',
        {
          label: 'ListarLivroUseCase',
          ...(idExecucao && { logId: idExecucao }),
          totalAutores: Array.isArray(autores?.data) ? autores.data.length : 0,
        },
        { autores }
      );

      const autoresData = Array.isArray(autores?.data) ? autores.data : [];
      const autoresDtoMap = autoresData.map((item) => {
        const autorEntity = Autor.create(item, Object.getOwnPropertyDescriptor(item, 'id')?.value);
        return AutorAdapter.toDTO(autorEntity);
      });
      livros.forEach((livro: LivroDTO) => {
        const autor = autoresDtoMap.find((autor) => autor.id === livro.autorId);
        if (autor) {
          livro.autor = autor;
        }
      });
      this.logService.info(
        '✅ Mapeamento de autores criado.',
        { label: 'ListarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        { autoresDtoMap }
      );

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
      this.logService.error(
        'Erro ao listar livros:',
        { label: 'ListarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new LivroInvalidoError('Falha ao listar livros.');
    }
  }
}
