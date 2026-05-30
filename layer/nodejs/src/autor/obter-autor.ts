import {
  Autor,
  Livro,
  PageDataType,
  AutorAdapter,
  LivroAdapter,
  UseCaseInterface,
  AutorInterface,
  LogService,
  LivroDTO,
} from '@gustavoadolfo/minhoteca-core-layer';
import {
  KeyValueAttr,
  RepositoryInterface,
  ResultType,
} from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ObterAutorUseCase implements UseCaseInterface {
  private _tabelaAutores: string;
  private _tabelaLivros: string;
  private logService = new LogService('ObterAutorUseCase');
  /**
   *
   */
  constructor(private _repository: RepositoryInterface) {
    this._tabelaAutores = process.env.TABELA_AUTORES || 'Autores';
    this._tabelaLivros = process.env.LIVRO_TABLE_NAME ?? 'Livros';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    try {
      const autorId = data.pathParameters?.id ?? data.queryStringParameters?.id;
      if (autorId) {
        const attributes: KeyValueAttr[] = [
          {
            attribute: {
              AttributeName: 'id',
              AttributeType: 'S',
            },
            attributeValue: autorId,
            partitionKey: false,
            sortKey: false,
          },
        ];
        const result: ResultType = await this._repository.queryData(
          this._tabelaAutores,
          attributes
        );
        if (result) {
          const autorEntity = Autor.create(
            result.data[0] as AutorInterface,
            Object.getOwnPropertyDescriptor(result.data[0], 'id')?.value
          );
          const autor = AutorAdapter.toDTO(autorEntity);

          const livros = await this._repository.getAll(this._tabelaLivros, {
            filterKey: 'autorId',
            filterValue: autorId,
            limit: 1000,
          });
          if (livros?.data?.length > 0) {
            const livrosDTO = LivroAdapter.toDTOList(livros.data as Livro[]);
            autor.livros = livrosDTO.map((livro) => {
              return {
                id: livro.id,
                titulo: livro.titulo,
                subtitulo: livro.subtitulo,
                imagemCapaUrl: livro.imagemCapaUrl,
              } as LivroDTO;
            });
          }

          return createResult([autor], 200, 'Autor obtido com sucesso.');
        }

        this.logService.warn('Autor não encontrado.', { autorId });
        return createResult([], 404, 'Autor não encontrado.');
      }

      throw new Error('ID do autor não informado.');
    } catch (error) {
      console.error('Erro ao obter autor:', error);
      throw new Error('Falha ao obter autor.');
    }
  }
}
