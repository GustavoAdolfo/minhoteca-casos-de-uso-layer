import {
  Autor,
  Livro,
  PageDataType,
  AutorAdapter,
  LivroAdapter,
  UseCaseInterface,
  LivroInterface,
  AutorInterface,
  LogService,
  LivroInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ObterLivroUseCase implements UseCaseInterface {
  private _tabelaLivros: string;
  private _tabelaAutores: string;
  private logService = new LogService('ObterLivroUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaLivros = process.env.TABELA_LIVROS ?? 'Livros';
    this._tabelaAutores = process.env.TABELA_AUTORES ?? 'Autores';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso ObterLivroUseCase',
      {
        label: 'ObterLivroUseCase',
        ...(idExecucao && { logId: idExecucao }),
      },
      { data }
    );
    try {
      const livroId = data.pathParameters?.id ?? data.queryStringParameters?.id;
      if (livroId) {
        const result: ResultType = await this._repository.findByMinhotecaId(
          this._tabelaLivros,
          livroId
        );
        this.logService.info(
          `Livro encontrado = ${!!result?.data}`,
          {
            livroId,
            label: 'ObterLivroUseCase',
            ...(idExecucao && { logId: idExecucao }),
          },
          { result }
        );
        if (result?.data) {
          this.logService.info(
            'Criando entidade Livro a partir dos dados recuperados',
            {
              label: 'ObterLivroUseCase',
              livroId,
              ...(idExecucao && { logId: idExecucao }),
            },
            { result }
          );
          const livroEntity = Livro.create(
            result.data as LivroInterface,
            Object.getOwnPropertyDescriptor(result.data, 'id')?.value
          );
          this.logService.info(
            'Convertendo Livro para DTO',
            {
              label: 'ObterLivroUseCase',
              livroId,
              ...(idExecucao && { logId: idExecucao }),
            },
            { result }
          );
          const livro = LivroAdapter.toDTO(livroEntity);

          this.logService.info('Buscando dados de autor associado ao livro', {
            label: 'ObterLivroUseCase',
            livroId,
            autorId: livro.autorId,
            ...(idExecucao && { logId: idExecucao }),
          });
          const autor = await this._repository.findByMinhotecaId(
            this._tabelaAutores,
            livro.autorId
          );
          this.logService.info(
            `Dados de autor recuperados = ${!!autor?.data}`,
            {
              label: 'ObterLivroUseCase',
              livroId,
              autorId: livro.autorId,
              ...(idExecucao && { logId: idExecucao }),
            },
            { autor }
          );

          if (autor?.data) {
            const autorData = autor.data as AutorInterface;
            const autorEntity = Autor.create(
              autorData,
              Object.getOwnPropertyDescriptor(autorData, 'id')?.value
            );
            const autorDTO = AutorAdapter.toDTO(autorEntity);
            livro.autor = autorDTO;
            this.logService.info(
              'Dados de autor adicionados ao DTO do livro',
              {
                label: 'ObterLivroUseCase',
                livroId,
                autorId: livro.autorId,
                ...(idExecucao && { logId: idExecucao }),
              },
              { livro }
            );
          }

          return createResult([livro], 200, 'Livro obtido com sucesso.');
        }

        this.logService.warn('Livro não encontrado.', {
          livroId,
          label: 'ObterLivroUseCase',
          ...(idExecucao && { logId: idExecucao }),
        });
        return createResult([], 404, 'Livro não encontrado.');
      }

      throw new LivroInvalidoError('ID do livro não informado.');
    } catch (error) {
      this.logService.error(
        'Falha ao obter livro:',
        { label: 'ObterLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new LivroInvalidoError('Falha ao obter livro.');
    }
  }
}
