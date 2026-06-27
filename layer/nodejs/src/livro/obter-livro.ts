import {
  Autor,
  Livro,
  PageDataType,
  AutorAdapter,
  LivroAdapter,
  UseCaseInterface,
  LivroInterface,
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
    this._tabelaAutores = process.env.TABELA_AUTORES || 'Autores';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso ObterLivroUseCase',
      {
        label: 'ObterLivroUseCase',
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
          `Livro encontrado = ${result != null && result.data != null && result.data.length > 0}`,
          {
            livroId,
            label: 'ObterLivroUseCase',
          },
          { result }
        );
        if (result) {
          this.logService.info(
            'Criando entidade Livro a partir dos dados recuperados',
            { label: 'ObterLivroUseCase', livroId },
            { result }
          );
          const livroEntity = Livro.create(
            result.data[0] as LivroInterface,
            Object.getOwnPropertyDescriptor(result.data[0], 'id')?.value
          );
          this.logService.info(
            'Convertendo Livro para DTO',
            { label: 'ObterLivroUseCase', livroId },
            { result }
          );
          const livro = LivroAdapter.toDTO(livroEntity);

          this.logService.info('Buscando dados de autor associado ao livro', {
            label: 'ObterLivroUseCase',
            livroId,
            autorId: livro.autorId,
          });
          const autor = await this._repository.findByMinhotecaId(
            this._tabelaAutores,
            livro.autorId
          );
          const autorData = autor?.data;
          const autorExists = Array.isArray(autorData) ? autorData.length > 0 : !!autorData;
          this.logService.info(
            `Dados de autor recuperados = ${autorExists}`,
            {
              label: 'ObterLivroUseCase',
              livroId,
              autorId: livro.autorId,
            },
            { autor }
          );

          if (autorExists) {
            const autorEntity = Array.isArray(autorData)
              ? (autorData[0] as Autor)
              : (autorData as Autor);
            const autorDTO = AutorAdapter.toDTO(autorEntity);
            livro.autor = autorDTO;
            this.logService.info(
              'Dados de autor adicionados ao DTO do livro',
              {
                label: 'ObterLivroUseCase',
                livroId,
                autorId: livro.autorId,
              },
              { livro }
            );
          }

          return createResult([livro], 200, 'Livro obtido com sucesso.');
        }

        this.logService.warn('Livro não encontrado.', { livroId, label: 'ObterLivroUseCase' });
        return createResult([], 404, 'Livro não encontrado.');
      }

      throw new LivroInvalidoError('ID do livro não informado.');
    } catch (error) {
      this.logService.error(
        'Falha ao obter livro:',
        { label: 'ObterLivroUseCase' },
        error as Error,
        { data }
      );
      throw new LivroInvalidoError('Falha ao obter livro.');
    }
  }
}
