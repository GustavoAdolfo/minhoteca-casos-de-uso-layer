import {
  Autor,
  Livro,
  PageDataType,
  AutorAdapter,
  LivroAdapter,
  UseCaseInterface,
  AutorInterface,
  LivroInterface,
  LogService,
  LivroDTO,
  AutorInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ObterAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private _tabelaLivros: string;
  private logService = new LogService('ObterAutorUseCase');

  constructor(
    private _repository: RepositoryInterface,
    private idExecucao?: string
  ) {
    this._tabelaAutores = process.env.TABELA_AUTORES ?? 'Autores';
    this._tabelaLivros = process.env.TABELA_LIVROS ?? 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso ObterAutorUseCase',
      {
        label: 'ObterAutorUseCase',
        logId: this.idExecucao,
      },
      { data }
    );
    try {
      const autorId = data.pathParameters?.id ?? data.queryStringParameters?.id;
      if (autorId) {
        const result: ResultType = await this._repository.findByMinhotecaId(
          this._tabelaAutores,
          autorId
        );
        this.logService.info(
          `Autor encontrado = ${!!result?.data}`,
          {
            autorId,
            label: 'ObterAutorUseCase',
            logId: this.idExecucao,
          },
          { result }
        );
        if (result?.data) {
          this.logService.info(
            'Criando entidade Autor a partir dos dados recuperados',
            { label: 'ObterAutorUseCase', autorId, logId: this.idExecucao },
            { result }
          );
          const autorEntity = Autor.create(
            result.data as AutorInterface,
            Object.getOwnPropertyDescriptor(result.data, 'id')?.value
          );
          this.logService.info(
            'Convertendo Autor para DTO',
            { label: 'ObterAutorUseCase', autorId, logId: this.idExecucao },
            { result }
          );
          const autor = AutorAdapter.toDTO(autorEntity);

          this.logService.info('Buscando dados de livros associados ao autor', {
            label: 'ObterAutorUseCase',
            autorId,
            logId: this.idExecucao,
          });

          const livros = await this._repository.getAll(this._tabelaLivros, {
            filterKey: 'autorId',
            filterValue: autorId,
            limit: 1000,
          });
          if (livros?.data?.length > 0) {
            const livroEntities = (livros.data as LivroInterface[]).map((livroData) =>
              Livro.create(livroData, Object.getOwnPropertyDescriptor(livroData, 'id')?.value)
            );
            const livrosDTO = LivroAdapter.toDTOList(livroEntities);
            autor.livros = livrosDTO.map((livro) => {
              return {
                id: livro.id,
                titulo: livro.titulo,
                subtitulo: livro.subtitulo,
                imagemCapaUrl: livro.imagemCapaUrl,
              } as LivroDTO;
            });
            this.logService.info(
              `Dados de livros recuperados = ${autor.livros.length > 0}`,
              {
                label: 'ObterAutorUseCase',
                autorId,
                livrosId: autor.livros.map((livro) => livro.id).join(', '),
                logId: this.idExecucao,
              },
              { autor }
            );
          }

          return createResult([autor], 200, 'Autor obtido com sucesso.');
        }

        this.logService.warn('Autor não encontrado.', {
          autorId,
          label: 'ObterAutorUseCase',
          logId: this.idExecucao,
        });
        return createResult([], 404, 'Autor não encontrado.');
      }

      throw new AutorInvalidoError('ID do autor não informado.');
    } catch (error) {
      this.logService.error(
        'Erro ao obter autor:',
        { label: 'ObterAutorUseCase', logId: this.idExecucao, data },
        error as Error
      );
      throw new AutorInvalidoError('Falha ao obter autor.');
    }
  }
}
