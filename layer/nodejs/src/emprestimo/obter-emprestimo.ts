import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import {
  UseCaseInterface,
  PageDataType,
  LogService,
  EmprestimoDTO,
} from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { createResult } from '../util';

// EmprestimoDTO enriquecido com os dados do livro consultado no repositório de livros
type EmprestimoComLivro = Omit<EmprestimoDTO, 'toJSONString'> & {
  livro?: unknown;
  toJSONString?: () => string;
};

export class ObterEmprestimoUseCase implements UseCaseInterface {
  private _tabelaEmprestimoUsuario: string;
  private _tabelaEmprestimoLivros: string;
  private _tabelaLivros: string;
  private logService = new LogService('ObterEmprestimoUseCase');

  constructor(
    private _repository: RepositoryInterface,
    private _livroRepository?: RepositoryInterface
  ) {
    this._tabelaEmprestimoUsuario = process.env.TABELA_EMPRESTIMO_USUARIO ?? 'EmprestimoUsuario';
    this._tabelaEmprestimoLivros = process.env.TABELA_EMPRESTIMO_LIVROS ?? 'EmprestimoLivros';
    this._tabelaLivros = process.env.TABELA_LIVROS ?? 'Livros';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso ObterEmprestimoUseCase',
      { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
      { data }
    );
    try {
      const { usuarioId, livroId } = { ...data.queryStringParameters };
      this.logService.info(
        'Dados recebidos para gravação',
        { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        { usuarioId, livroId }
      );

      if (!usuarioId && !livroId) {
        throw new Error('Nenhum identificador de usuário ou livro fornecido.');
      }

      let resultEmprestimo: EmprestimoComLivro[] = [];

      if (usuarioId) {
        const resultEmprestimoUsuario: ResultType = await this._repository.getData(
          this._tabelaEmprestimoUsuario,
          { name: 'usuarioId', value: usuarioId, type: 'S' }
        );
        this.logService.info(
          'Resultado da consulta de empréstimo do usuário',
          { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
          { resultEmprestimoUsuario }
        );
        const dataResult = this.normalizeEmprestimo(resultEmprestimoUsuario?.data);
        if (dataResult.length > 0) {
          resultEmprestimo.push(...dataResult.map((item) => this.stripInternalMethods(item)));
          if (resultEmprestimo.length > 0 && this._livroRepository) {
            resultEmprestimo = await Promise.all(
              resultEmprestimo.map(async (item) => {
                const livro = await this._livroRepository?.findByMinhotecaId(
                  this._tabelaLivros,
                  item.livroId
                );
                const mappedItem = {
                  ...item,
                  livro: livro?.data?.[0] ?? null,
                } as EmprestimoComLivro;

                mappedItem.toJSONString = () => JSON.stringify(mappedItem);
                return mappedItem;
              })
            );
          }
        }
      }

      if (livroId) {
        const resultEmprestimoLivro: ResultType = await this._repository.getData(
          this._tabelaEmprestimoLivros,
          { name: 'livroId', value: livroId, type: 'S' }
        );
        this.logService.info(
          'Resultado da consulta de empréstimo do livro',
          { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
          { resultEmprestimoLivro }
        );
        const dataResult = this.normalizeEmprestimo(resultEmprestimoLivro?.data);
        if (dataResult.length > 0) {
          resultEmprestimo.push(...dataResult.map((item) => this.stripInternalMethods(item)));

          if (this._livroRepository) {
            const livro = await this._livroRepository?.findByMinhotecaId(
              this._tabelaLivros,
              livroId
            );
            for (const item of resultEmprestimo) {
              item.livro = livro?.data?.[0] ?? null;
            }
          }
        }
      }

      return createResult(
        resultEmprestimo as unknown as EmprestimoDTO[],
        200,
        'Empréstimo criado com sucesso'
      );
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message.trim();
        if (message === 'Nenhum identificador de usuário ou livro fornecido.') {
          throw error;
        }
      }

      this.logService.error(
        'Erro ao criar empréstimo:',
        { label: 'ObterEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new Error('Falha ao criar empréstimo.');
    }
  }

  private normalizeEmprestimo(data: unknown): EmprestimoDTO[] {
    if (Array.isArray(data)) {
      return data.flatMap((item) => this.normalizeEmprestimo(item));
    }

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const indexedValue = record['0'];

      if (indexedValue && typeof indexedValue === 'object') {
        return this.normalizeEmprestimo(indexedValue);
      }

      const normalizedData = Object.fromEntries(
        Object.entries(record).filter(([key]) => key !== 'toJSONString' && key !== '0')
      );

      return [normalizedData as unknown as EmprestimoDTO];
    }

    return data ? [data as EmprestimoDTO] : [];
  }

  private stripInternalMethods(data: EmprestimoDTO): EmprestimoDTO {
    if (data && typeof data === 'object' && '0' in data) {
      const indexedValue = (data as Record<string, unknown>)['0'];
      if (indexedValue && typeof indexedValue === 'object') {
        return this.stripInternalMethods(indexedValue as EmprestimoDTO);
      }
    }

    return Object.fromEntries(
      Object.entries(data).filter(([key]) => key !== 'toJSONString' && key !== '0')
    ) as unknown as EmprestimoDTO;
  }
}
